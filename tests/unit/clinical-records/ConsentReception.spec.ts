import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { FolderConsentReceiver, receivedDocumentMime, assertConsentReceptionFolder } from '@/contexts/clinical-records/infrastructure/consent-reception/FolderConsentReceiver';
import { ConsentReceptionSettings } from '@/contexts/clinical-records/infrastructure/consent-reception/ConsentReceptionSettings';
import { verifyConsentFolderSelection } from '@/contexts/clinical-records/infrastructure/consent-reception/nativeFolderSelection';
import { SqliteConsentInboxRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentInboxRepository';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { LocalPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/LocalPatientFileStorage';
import { ReviewReceivedConsent } from '@/contexts/clinical-records/application/review-received-consent/ReviewReceivedConsent';
import { ReviewReceivedConsentMessage } from '@/contexts/clinical-records/application/review-received-consent/ReviewReceivedConsentMessage';
import { ConsentReceptionId } from '@/contexts/clinical-records/domain/value-objects/ConsentReceptionId';
import { ConsentSignatureDate } from '@/contexts/clinical-records/domain/value-objects/ConsentSignatureDate';
import { getDb } from '@/shared/infrastructure/persistence/SqliteConnection';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-reception-test-'));
const folder = path.join(directory, 'drive'); fs.mkdirSync(folder);
const owner = randomUUID(), other = randomUUID(), patient = randomUUID(), otherPatient = randomUUID();
const pdf = Buffer.from('%PDF-1.4\nDocumento de prueba firmado\n%%EOF');
let clock = Date.now();
beforeAll(() => {
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  process.env.DATABASE_PATH = path.join(directory,'test.db'); process.env.UPLOADS_PATH = path.join(directory,'uploads'); process.env.CONSENT_RECEPTION_DEVICE_ID = randomUUID(); process.env.SESSION_SECRET = 'test-native-folder-secret';
  delete (globalThis as {__escuchainternaDb?:unknown}).__escuchainternaDb;
  delete (globalThis as {__escuchainternaDbAdapter?:unknown}).__escuchainternaDbAdapter;
  const db=getDb();
  for(const id of [owner,other]) db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run(id,`${id}@demo.test`,'fake-password-hash',new Date().toISOString());
  for(const [id,user] of [[patient,owner],[otherPatient,other]]) db.prepare('INSERT INTO patients (id,full_name,owner_user_id,created_at) VALUES (?,?,?,?)').run(id,'Paciente de prueba',user,new Date().toISOString());
});
afterAll(async () => { await new ConsentReceptionSettings(owner).disconnect(); await new FolderConsentReceiver(owner).receive(); vi.restoreAllMocks(); getDb().close(); delete (globalThis as {__escuchainternaDb?:unknown}).__escuchainternaDb; delete (globalThis as {__escuchainternaDbAdapter?:unknown}).__escuchainternaDbAdapter; fs.rmSync(directory,{recursive:true,force:true}); });

describe('Recepción local de consentimientos', () => {
  it('importa solo después de dos observaciones estables, cifra la copia y sugiere el paciente de la consulta', async () => {
    const repo=new SqliteConsentInboxRepository(owner); const code=await repo.codeForPatient(patient);
    await new ConsentReceptionSettings(owner).connect(folder);
    fs.writeFileSync(path.join(folder,`${code}__firmado.pdf`),pdf);
    const receiver=new FolderConsentReceiver(owner);
    expect((await receiver.receive()).imported).toBe(0);
    expect((await receiver.receive()).imported).toBe(0); clock += 2000;
    expect((await receiver.receive()).imported).toBe(1);
    const [receipt]=await repo.list();
    expect(receipt.status).toBe('pendiente'); expect(receipt.suggestedPatientId).toBe(patient);
    expect(getDb().prepare('SELECT document_json FROM received_consents WHERE id=?').get(receipt.id)?.document_json).toMatch(/^enc:v1:/);
    const file=fs.readFileSync(path.join(process.env.UPLOADS_PATH!,receipt.document.storedPath)); expect(file.equals(pdf)).toBe(false);
    expect(Buffer.from((await new LocalPatientFileStorage().read(receipt.document.storedPath))!)).toEqual(pdf);
    expect(await new SqlitePatientConsentRepository(owner).findLatestByPatient(patient)).toBeNull();
  });
  it('no duplica un documento cuando Drive lo renombra ni durante dos revisiones concurrentes', async () => {
    fs.writeFileSync(path.join(folder,'copia-renombrada.pdf'),pdf);
    const receiver=new FolderConsentReceiver(owner); await receiver.receive();
    clock += 2000;
    await Promise.all([receiver.receive(), receiver.receive()]);
    expect((await new SqliteConsentInboxRepository(owner).list()).length).toBe(1);
  });
  it('ignora un PDF incompleto hasta terminar la descarga, y nunca asocia un código ajeno', async () => {
    const code=await new SqliteConsentInboxRepository(other).codeForPatient(otherPatient);
    const file=path.join(folder,`${code}__otro.pdf`);
    fs.writeFileSync(file,'%PDF-1.4\nArchivo incompleto');
    const receiver=new FolderConsentReceiver(owner); await receiver.receive(); clock += 2000; await receiver.receive();
    expect((await new SqliteConsentInboxRepository(owner).list()).length).toBe(1);
    fs.writeFileSync(file,'%PDF-1.4\nOtro documento firmado\n%%EOF');
    await receiver.receive(); clock += 2000; expect((await receiver.receive()).imported).toBe(1);
    const receipt=(await new SqliteConsentInboxRepository(owner).list()).find(r=>r.document.filename.includes(code))!;
    expect(receipt.suggestedPatientId).toBeNull();
    expect(await new SqliteConsentInboxRepository(other).find(new ConsentReceptionId(receipt.id))).toBeNull();
  });
  it('archiva tras revisión, conserva la recepción y la firma por separado, sin autorizar IA', async () => {
    const inbox=new SqliteConsentInboxRepository(owner); const receipt=(await inbox.list()).find(r=>r.suggestedPatientId===patient)!; const db=getDatabaseAdapter(); const consents=new SqlitePatientConsentRepository(owner);
    const review=new ReviewReceivedConsent(inbox,consents,new SqlitePatientDirectory(owner),work=>db.transaction(work));
    await expect(review.review(new ReviewReceivedConsentMessage(receipt.id,otherPatient,'2026-01-02',true))).rejects.toThrow('paciente');
    expect(()=>new ReviewReceivedConsentMessage(receipt.id,patient,'2026-01-02',false)).toThrow('Confirma');
    await review.review(new ReviewReceivedConsentMessage(receipt.id,patient,'2026-01-02',true));
    const consent=(await consents.findLatestByPatient(patient))!;
    expect(consent.isGranted()).toBe(true); expect(consent.grantsAiProcessing()).toBe(false);
    expect(consent.toPrimitives().signedAt?.slice(0,10)).toBe('2026-01-02');
    expect(consent.toPrimitives().filePath).toBe(receipt.document.storedPath);
    const archived=(await inbox.find(new ConsentReceptionId(receipt.id)))!.toPrimitives();
    expect(archived.status).toBe('archivado'); expect(archived.receivedAt).toBe(receipt.receivedAt); expect(archived.signedDate).toBe('2026-01-02');
    await expect(review.review(new ReviewReceivedConsentMessage(receipt.id,patient,'2026-01-02',true))).rejects.toThrow('ya fue revisado');
    expect((await consents.listByPatient(patient)).length).toBe(1);
  });
  it('conserva el archivo descartado y no lo vuelve a importar', async () => {
    const inbox=new SqliteConsentInboxRepository(owner); const receipt=(await inbox.list()).find(r=>r.status==='pendiente')!;
    const aggregate=(await inbox.find(new ConsentReceptionId(receipt.id)))!; aggregate.dismiss(); await inbox.save(aggregate);
    expect((await new FolderConsentReceiver(owner).receive()).imported).toBe(0);
    expect(await new LocalPatientFileStorage().read(receipt.document.storedPath)).not.toBeNull();
  });
  it('separa la carpeta por PC y no admite la carpeta de respaldos cifrados', async () => {
    await expect(new SqliteConsentInboxRepository(owner).codeForPatient(otherPatient)).rejects.toThrow('paciente');
    const previous=process.env.CONSENT_RECEPTION_DEVICE_ID; process.env.CONSENT_RECEPTION_DEVICE_ID=randomUUID();
    expect(await new ConsentReceptionSettings(owner).read()).toBeNull(); process.env.CONSENT_RECEPTION_DEVICE_ID=previous;
    const backup=path.join(directory,'backups');fs.mkdirSync(backup);fs.writeFileSync(path.join(backup,`${randomUUID()}.eichannel`),'test');
    await expect(assertConsentReceptionFolder(backup)).rejects.toThrow('distinta');
  });
  it('rechaza MIME fingido, SVG y fechas inválidas', () => {
    expect(receivedDocumentMime(Buffer.from('<svg onload="bad()"/>'),'.png')).toBeNull(); expect(receivedDocumentMime(pdf,'.exe')).toBeNull();
    expect(()=>new ConsentSignatureDate('2026-02-30')).toThrow(); expect(()=>new ConsentSignatureDate('2999-01-01')).toThrow();
  });
  it('acepta únicamente selecciones nativas para la cuenta, PC y período correctos', () => {
    const token=(payload:object) => { const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${encoded}.${createHmac('sha256',process.env.SESSION_SECRET!).update(`consent-folder:${encoded}`).digest('base64url')}`; };
    const selected={folder,owner,device:process.env.CONSENT_RECEPTION_DEVICE_ID,expires:Date.now()+200000};
    expect(verifyConsentFolderSelection(token(selected),owner)).toBe(folder);
    expect(()=>verifyConsentFolderSelection(token({...selected,owner:other}),owner)).toThrow();
    expect(()=>verifyConsentFolderSelection(token({...selected,expires:Date.now()-1}),owner)).toThrow();
    expect(()=>verifyConsentFolderSelection(token(selected)+'x',owner)).toThrow();
    expect(()=>verifyConsentFolderSelection(token({...selected,folder:'../otro'}),owner)).toThrow();
  });
  it('valida un enlace prellenado de Forms y permite quitarlo', async () => {
    const settings=new ConsentReceptionSettings(owner); await expect(settings.setFormTemplate('https://example.com?entry.123=CODIGO')).rejects.toThrow();
    await settings.setFormTemplate('https://docs.google.com/forms/d/e/test-form/viewform?entry.123=CODIGO'); expect((await settings.read())?.formTemplate).toContain('CODIGO');
    await settings.setFormTemplate(''); expect((await settings.read())?.formTemplate).toBe('');
  });
  it('continúa la recepción cuando la carpeta acumula más de mil entradas antiguas', async () => {
    const large=path.join(directory,'large'); fs.mkdirSync(large);
    for(let i=0;i<1100;i++) fs.writeFileSync(path.join(large,`archivo-antiguo-${String(i).padStart(4,'0')}.txt`),'Entrada antigua que no es un documento admitido');
    const filename='nuevo-consentimiento.pdf'; fs.writeFileSync(path.join(large,filename),'%PDF-1.4\nDocumento al final de una carpeta grande\n%%EOF');
    await new ConsentReceptionSettings(owner).connect(large);
    const receiver=new FolderConsentReceiver(owner);
    for(let scan=0;scan<8;scan++){clock+=2000;await receiver.receive();}
    expect((await new SqliteConsentInboxRepository(owner).list()).some(receipt=>receipt.document.filename===filename)).toBe(true);
  });
});

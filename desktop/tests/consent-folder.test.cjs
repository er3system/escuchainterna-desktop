const test = require('node:test'); const assert = require('node:assert/strict'); const { createHmac } = require('node:crypto');
const { isConsentFolderSender, signConsentFolderSelection } = require('../consent-folder.cjs');
test('selección de carpeta rechaza otros orígenes, pantallas y subframes', () => {
  const contents={ mainFrame:{} }; const frame=contents.mainFrame; const origin='http://127.0.0.1:4567'; frame.url=origin+'/consentimientos';
  const event={sender:contents,senderFrame:frame}; assert.equal(isConsentFolderSender(event,contents,origin),true);
  frame.url=origin+'/inicio'; assert.equal(isConsentFolderSender(event,contents,origin),false);
  frame.url='https://example.com/consentimientos'; assert.equal(isConsentFolderSender(event,contents,origin),false);
  frame.url=origin+'/consentimientos'; assert.equal(isConsentFolderSender({...event,senderFrame:{url:frame.url}},contents,origin),false);
});
test('firma una selección específica para cuenta y PC, sin revelar el secreto', () => {
  const owner='b3f0de15-3de1-4932-a892-023bb4631ffd'; const secret='secret-native-test'; const token=signConsentFolderSelection('G:\\Mi unidad\\Recepcion',owner,secret,'device-id');
  const [encoded,signature]=token.split('.');const payload=JSON.parse(Buffer.from(encoded,'base64url'));
  assert.equal(payload.owner,owner);assert.equal(payload.device,'device-id');assert(payload.expires>Date.now());assert.equal(signature,createHmac('sha256',secret).update(`consent-folder:${encoded}`).digest('base64url'));assert(!token.includes(secret));
});

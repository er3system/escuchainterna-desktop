import { describe, it, expect } from 'vitest';
import {
  GenerateSessionBriefing,
  BRIEFING_PROMPT,
} from '@/contexts/assistant/application/generate-session-briefing/GenerateSessionBriefing';
import type { AssistantEngine } from '@/contexts/assistant/domain/AssistantEngine';
import type {
  PatientContextRetriever,
  RetrievedPatientContext,
  RetrievedPatientSummary,
} from '@/contexts/assistant/domain/PatientContextRetriever';

function ctx(name: string): RetrievedPatientContext {
  return {
    patient: { id: 'p1', fullName: name, gender: 'femenino', birthDate: null, consultationReason: 'Ansiedad', therapyStartDate: null, tags: [] },
    diagnoses: [],
    recentNotes: [],
    clinicalRecords: [],
    upcomingBookings: [],
  };
}

class FakeRetriever implements PatientContextRetriever {
  public calls: string[] = [];
  constructor(private readonly context: RetrievedPatientContext | null) {}
  async listPatients(): Promise<RetrievedPatientSummary[]> {
    return [];
  }
  async retrieve(patientId: string): Promise<RetrievedPatientContext | null> {
    this.calls.push(patientId);
    return this.context;
  }
}

class FakeEngine implements AssistantEngine {
  public answered: Array<{ question: string; hasContext: boolean }> = [];
  classifyScope() {
    return 'permitido' as const;
  }
  async answer(question: string, context: RetrievedPatientContext | null): Promise<string> {
    this.answered.push({ question, hasContext: context !== null });
    return 'BRIEFING\n\n**Fuentes**\n[1] nota';
  }
  async *answerStream(question: string, context: RetrievedPatientContext | null): AsyncGenerator<string> {
    yield await this.answer(question, context);
  }
  providerName(): 'local' {
    return 'local';
  }
}

describe('GenerateSessionBriefing', () => {
  it('sin contexto (paciente sin consentimiento-IA / inexistente): NO disponible, NO toca el motor ni traza', async () => {
    const retriever = new FakeRetriever(null);
    const engine = new FakeEngine();
    const audit: string[] = [];
    const briefing = new GenerateSessionBriefing(retriever, engine, async (id) => void audit.push(id));

    const result = await briefing.execute('p1');

    expect(result.available).toBe(false);
    expect(result.text).toBe('');
    expect(engine.answered).toHaveLength(0); // cero dato al LLM
    expect(audit).toEqual([]); // sin acceso → sin traza
  });

  it('con contexto: genera con el prompt de briefing, traza el acceso y reusa el motor', async () => {
    const retriever = new FakeRetriever(ctx('María García'));
    const engine = new FakeEngine();
    const audit: string[] = [];
    const briefing = new GenerateSessionBriefing(retriever, engine, async (id) => void audit.push(id));

    const result = await briefing.execute('p1');

    expect(result.available).toBe(true);
    expect(result.text).toContain('BRIEFING');
    expect(engine.answered).toEqual([{ question: BRIEFING_PROMPT, hasContext: true }]);
    expect(audit).toEqual(['p1']); // se recuperó contexto → queda traza de acceso de IA
  });
});

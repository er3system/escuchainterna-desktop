/**
 * DTOs planos del asistente. Módulo PURO (solo interfaces, sin dependencias):
 * los client components pueden importarlos con `import type` sin arrastrar
 * módulos de Node al bundle del navegador.
 */

export interface ThreadSummaryDto {
  id: string;
  title: string;
  patientId: string | null;
  patientName: string | null;
  updatedAt: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'usuario' | 'asistente';
  content: string;
  createdAt: string;
}

export interface ThreadDetailDto {
  id: string;
  title: string;
  patientId: string | null;
  patientName: string | null;
  messages: ChatMessageDto[];
}

export interface PatientOptionDto {
  id: string;
  fullName: string;
}

export type MessageScope = 'permitido' | 'rechazado' | 'mixto';

export interface SendMessageResultDto {
  threadId: string;
  threadTitle: string;
  patientId: string | null;
  patientName: string | null;
  scope: MessageScope;
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

import { AsyncLocalStorage } from 'async_hooks';

/** Contexto da execução: no simulador nada sai pelo WhatsApp nem grava no sistema escolar. */
export const contexto = new AsyncLocalStorage();
export const simulando = () => !!contexto.getStore()?.simulacao;

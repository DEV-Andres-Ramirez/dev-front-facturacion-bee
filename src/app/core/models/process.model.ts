/** Paso del ciclo de facturación mostrado en el stepper. */
export interface ProcessStep {
  readonly label: string;
}

/** Los 7 pasos del ciclo automatizado (mapa de procesos, sección 3 del SRS). */
export const PROCESS_STEPS: readonly ProcessStep[] = [
  { label: 'Carga' },
  { label: 'Validar' },
  { label: 'Agrupar' },
  { label: 'Revisar' },
  { label: 'Entregar' },
  { label: 'Conciliar' },
  { label: 'Archivar' },
] as const;

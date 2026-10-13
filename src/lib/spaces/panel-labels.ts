import type { SpacePanelConfig } from '@/types/spaces';

type SpacesTranslator = (key: string) => string;

export function getSpacePanelLabel(panel: SpacePanelConfig, t: SpacesTranslator): string {
  switch (panel.surface) {
    case 'cv_workspace':
      return t('panelCv');
    case 'interview_irp':
      return t('panelInterview');
    case 'english_epp':
      return t('panelEnglish');
    default:
      return panel.panel_id;
  }
}

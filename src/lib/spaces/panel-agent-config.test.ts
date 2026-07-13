import { describe, expect, it } from 'vitest';

import {
  getSpacePanelReturnHref,
  resolveSpacePanelAgentConfig,
} from '@/lib/spaces/panel-agent-config';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';

describe('resolveSpacePanelAgentConfig', () => {
  it('maps cv_workspace to cv builder', () => {
    expect(resolveSpacePanelAgentConfig('cv_workspace')).toEqual({
      fromSurface: 'cv',
      hubAgentId: CV_BUILDER_AGENT_ID,
    });
  });

  it('maps interview_irp to mock interview', () => {
    expect(resolveSpacePanelAgentConfig('interview_irp')).toEqual({
      fromSurface: 'interview',
      hubAgentId: MOCK_INTERVIEW_AGENT_ID,
    });
  });

  it('maps english_epp to english tutor', () => {
    expect(resolveSpacePanelAgentConfig('english_epp')).toEqual({
      fromSurface: 'english',
      hubAgentId: ENGLISH_TUTOR_AGENT_ID,
    });
  });
});

describe('getSpacePanelReturnHref', () => {
  it('returns encoded space route', () => {
    expect(getSpacePanelReturnHref('zh', 'sp_abc/def')).toBe(
      '/zh/spaces/sp_abc%2Fdef'
    );
  });
});

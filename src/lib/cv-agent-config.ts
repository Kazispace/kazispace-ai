/** When true, `/cv` uses Agent Hub (`cv_builder`) instead of legacy `POST /cv/chat`. */
export const CV_AGENT_HUB_ENABLED =
  process.env.NEXT_PUBLIC_CV_AGENT_HUB === 'true';

export const CV_BUILDER_AGENT_ID = 'cv_builder';

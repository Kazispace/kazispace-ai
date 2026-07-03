export interface NextBestActionItem {
  action_type: string;
  title: string;
  description: string;
  redirect_url: string;
}

export interface NextBestActionResponse {
  user_id: number;
  hook_state: string;
  hook_state_label: string;
  current_main_value?: string;
  next_best_action_key: string;
  next_best_action: NextBestActionItem;
}

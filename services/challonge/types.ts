
type Timestamp = string;

export interface ApiTournament {
  tournament: {
    accept_attachments: boolean;
    allow_participant_match_reporting: boolean;
    anonymous_voting: boolean;
    category: unknown | null;
    check_in_duration: unknown | null;
    completed_at: Timestamp | null;
    created_at: Timestamp;
    created_by_api: boolean;
    credit_capped: boolean;
    description: string;
    game_id: number;
    group_stages_enabled: boolean;
    hide_forum: boolean;
    hide_seeds: boolean;
    hold_third_place_match: boolean;
    id: number;
    max_predictions_per_user: number;
    name: string;
    notify_users_when_matches_open: boolean;
    notify_users_when_the_tournament_ends: boolean;
    open_signup: boolean;
    participants_count: number;
    prediction_method: number;
    predictions_opened_at: Timestamp | null;
    private: boolean;
    progress_meter: number;
    pts_for_bye: string;
    pts_for_game_tie: string;
    pts_for_game_win: string;
    pts_for_match_tie: string;
    pts_for_match_win: string;
    quick_advance: boolean;
    ranked_by: string;
    require_score_agreement: boolean;
    rr_pts_for_game_tie: string;
    rr_pts_for_game_win: string;
    rr_pts_for_match_tie: string;
    rr_pts_for_match_win: string;
    sequential_pairings: boolean;
    show_rounds: boolean;
    signup_cap: number | null;
    start_at: Timestamp | null;
    started_at: Timestamp | null;
    started_checking_in_at: Timestamp | null;
    state: string;
    swiss_rounds: number;
    teams: boolean;
    tie_breaks: string[];
    tournament_type: "single elimination" | "double elimination" | string;
    updated_at: Timestamp | null;
    url: string;
    description_source: string;
    subdomain: string | null;
    full_challonge_url: string;
    live_image_url: string;
    sign_up_url: string | null;
    review_before_finalizing: boolean;
    accepting_predictions: boolean;
    participants_locked: boolean;
    game_name: string;
    participants_swappable: boolean;
    team_convertable: boolean;
    group_stages_were_started: boolean;
  };
}

export interface ApiMatch {
  match: {
    attachment_count: number | null;
    created_at: Timestamp;
    group_id: unknown | null;
    has_attachment: boolean;
    id: number;
    identifier: string;
    loser_id: number | null;
    player1_id: number | null;
    player1_is_prereq_match_loser: boolean;
    player1_prereq_match_id: number | null;
    player1_votes: unknown | null;
    player2_id: number | null;
    player2_is_prereq_match_loser: boolean;
    player2_prereq_match_id: number | null;
    player2_votes: unknown | null;
    round: number;
    scheduled_time: Timestamp | null;
    started_at: Timestamp | null;
    state: string;
    tournament_id: number;
    underway_at: Timestamp | null;
    updated_at: Timestamp;
    winner_id: number | null;
    prerequisite_match_ids_csv: string;
    scores_csv: string;
    suggested_play_order: number;
  };
}

export interface ApiParticipant {
  participant: {
    active: boolean;
    checked_in_at: Timestamp | null;
    created_at: Timestamp;
    final_rank: number | null;
    group_id: unknown | null;
    icon: unknown | null;
    id: number;
    invitation_id: unknown | null;
    invite_email: unknown | null;
    misc: unknown | null;
    name: string;
    on_waiting_list: boolean;
    seed: number;
    tournament_id: number;
    updated_at: Timestamp;
    challonge_username: string | null;
    challonge_email_address_verified: boolean;
    removable: boolean;
    participatable_or_invitation_attached: boolean;
    confirm_remove: boolean;
    invitation_pending: boolean;
    display_name_with_invitation_email_address: string;
    email_hash: string | null;
    username: string | null;
    attached_participatable_portrait_url: string | null;
    can_check_in: boolean;
    checked_in: boolean;
    reactivatable: boolean;
    display_name: string;
  };
}

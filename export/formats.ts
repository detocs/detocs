import ExportFormat from './export-format';

export const ScoreboardAssistantPeople: ExportFormat = `{{#each .}}
{{escapeDoublePipe handle}}{{#if prefix}} || {{escapeDoublePipe prefix}}{{/if}}
{{/each}}
`;

export const ScoreboardAssistantPeopleWithTwitter: ExportFormat = `{{#each .}}
{{escapeDoublePipe handle}}{{#if prefix}} || {{escapeDoublePipe prefix}}{{/if}}{{#if twitter}} @{{escapeDoublePipe twitter}}{{/if}}
{{/each}}
`;

export const StreamControlPeople: ExportFormat = `{{#each .}}
{{escapeCsv handle}},{{#if prefix}}{{escapeCsv prefix}}{{/if}}
{{/each}}
`;

export const StreamControlPeopleWithTwitter: ExportFormat = `{{#each .}}
{{escapeCsv handle}},{{#if prefix}}{{escapeCsv prefix}}{{/if}},{{#if twitter}}{{escapeCsv twitter}}{{/if}}
{{/each}}
`;

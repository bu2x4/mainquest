'use strict';
/* MainQuest build-time defaults. Edit before building to change what a fresh install starts with.
   Everything here can also be changed later on the phone in Profile → Grown-up zone. */
const APP_CONFIG = {
  ai: {
    enabled: false,                                   // Study AI connection ships OFF
    endpoint: 'https://api.anthropic.com/v1/messages', // or your own proxy URL later
    apiVersion: '2023-06-01',
    model: 'claude-sonnet-5-5',
    models: [['claude-sonnet-5-5', 'Sonnet 5.5 — best'], ['claude-haiku-5-5', 'Haiku 5.5 — cheaper']],
    maxPages: 6,          // pages sent per paper
    monthlyLimit: 100,    // study-pack builds per calendar month (0 = no limit)
  },
  planDays: 7,            // rolling planner length
};

export const NETWORKING_TIPS: string[] = [
  "Start with people you already have a connection to — alumni from your school, past coworkers, or friends-of-friends respond far more often than a stranger.",
  "A warm intro beats a cold email. Ask an existing contact if they know anyone at a company you're targeting before reaching out cold.",
  "Keep the ask small. A 15-20 minute call is easy to say yes to — asking someone to \"help you get a job\" is not.",
  "Follow up once if you don't hear back within a week or two. One polite nudge is normal, not annoying.",
  "Log how you met someone and what you talked about. Future-you won't remember, and it makes the next conversation warmer.",
  "Say thank you after every conversation. It costs nothing and people remember who did it.",
];

export type EmailTemplate = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

// v1: a handful of fixed templates for the most common situations. Later
// this can grow into a picker with more specific occasions — not worth
// building until these get used.
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "alumni",
    label: "Alumni outreach",
    subject: "Fellow [School] grad — quick question about [Company]",
    body: `Hi [Name],

I'm a [School] [year/major] student currently exploring [role type] roles, and I saw you're at [Company] — small world! I'd love to hear about your experience there if you have 15-20 minutes sometime in the next couple weeks.

No pressure at all if you're swamped — just thought the [School] connection was worth a shot.

Thanks either way,
[Your name]`,
  },
  {
    id: "cold",
    label: "Cold outreach",
    subject: "Quick question about [Team/Role] at [Company]",
    body: `Hi [Name],

My name is [Your name], and I'm a [year/major] student interested in [team/role] at [Company]. I came across your profile and was impressed by [specific detail — a project, a post, their path into the role].

Would you be open to a quick 15-minute call in the next few weeks? I'd love to hear about your experience and any advice you'd have for someone trying to break in.

Thanks for considering it — I know these requests add up.

Best,
[Your name]`,
  },
  {
    id: "follow_up",
    label: "Post-chat thank-you",
    subject: "Thanks for the chat!",
    body: `Hi [Name],

Thank you for taking the time to talk with me today — I really enjoyed hearing about [specific thing they mentioned], and it gave me a much clearer picture of what it's like to work on [team/at Company].

I'll keep you posted on how things go, and please don't hesitate to reach out if there's ever anything I can help with on my end.

Thanks again,
[Your name]`,
  },
  {
    id: "reconnect",
    label: "Reconnecting",
    subject: "Been a while — how are things at [Company]?",
    body: `Hi [Name],

It's been a bit since we last talked — I hope things have been going well at [Company]! Wanted to reconnect and share that [update: I'm applying for X / graduating in Y / etc.].

Would love to catch up whenever you have a few minutes, even just a quick note on how things are going on your end.

Best,
[Your name]`,
  },
];

import { istStart, upcomingFestivals } from './festivals';
import { AdminReminder, Festival, FestivalOccurrence, Offer, ReminderLevel } from './types';

const DAY = 86_400_000;

/** True once an active offer linked to this festival runs into its dates. */
export function festivalHasOffers(occ: FestivalOccurrence, offers: Offer[]): boolean {
  return offers.some((o) => o.festivalId === occ.festival.id && o.isActive && new Date(o.endsAt).getTime() >= occ.start.getTime());
}

function level(weeks: number, ready: boolean): ReminderLevel {
  if (ready) return 'info';
  if (weeks <= 1) return 'urgent';
  if (weeks <= 3) return 'warning';
  return 'info';
}

/**
 * Admin reminders due at `now`: one per upcoming festival, for the most
 * recent reminder tier reached (e.g. "4 weeks to Diwali"). Ids include the
 * tier, so dismissing the 6-week reminder still lets the 2-week one fire.
 */
export function dueReminders(festivals: Festival[], offers: Offer[], now: Date, dismissed: string[] = []): AdminReminder[] {
  const t = now.getTime();
  const out: AdminReminder[] = [];
  const maxWeeks = Math.max(1, ...festivals.flatMap((f) => f.reminderWeeks));
  for (const occ of upcomingFestivals(festivals, now, maxWeeks * 7 + 1)) {
    if (occ.start.getTime() <= t) continue; // already started: reminders are for planning ahead
    const daysLeft = Math.ceil((occ.start.getTime() - t) / DAY);
    const tiers = [...occ.festival.reminderWeeks].sort((a, b) => a - b);
    const tier = tiers.find((w) => t >= occ.start.getTime() - w * 7 * DAY);
    if (tier === undefined) continue;
    const id = `${occ.festival.id}-${occ.year}-${tier}w`;
    if (dismissed.includes(id)) continue;
    const ready = festivalHasOffers(occ, offers);
    const when = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
    const startLabel = istStart(occ.festival.dates[occ.year].start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    out.push({
      id,
      festivalId: occ.festival.id,
      festivalName: occ.festival.name,
      year: occ.year,
      level: level(tier, ready),
      title: ready ? `${occ.festival.name} offers are scheduled` : `${occ.festival.name} is ${when}: set up your offers`,
      body: ready
        ? `${occ.festival.name} starts ${startLabel}. Your linked offers are active; review stock limits and banners.`
        : `${occ.festival.name} starts ${startLabel}. The site switches to the ${occ.festival.name} theme ${occ.festival.themeLeadDays} days before. ` +
          `Create the draft offers (festival sale, coupon, bank offer, lightning deals) and activate them.`,
      dueAt: new Date(occ.start.getTime() - tier * 7 * DAY).toISOString(),
      festivalStart: occ.festival.dates[occ.year].start,
      daysLeft,
      offersReady: ready,
    });
  }
  // Most pressing first.
  const rank: Record<ReminderLevel, number> = { urgent: 0, warning: 1, info: 2 };
  return out.sort((a, b) => Number(a.offersReady) - Number(b.offersReady) || rank[a.level] - rank[b.level] || a.daysLeft - b.daysLeft);
}

/** Count for the bell badge: reminders that still need action. */
export function pendingCount(reminders: AdminReminder[]): number {
  return reminders.filter((r) => !r.offersReady).length;
}

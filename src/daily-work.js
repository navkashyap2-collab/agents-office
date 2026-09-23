// A daily work indicator complements the operational outcome counters. A quiet day
// can still contain real CEO/agent analysis, triage and pipeline work, so never imply
// that a zero in the sales or email cards means nobody worked.
export function perthDayStartMs(nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const field = type => parts.find(part => part.type === type)?.value;
  return Date.UTC(Number(field('year')), Number(field('month')) - 1, Number(field('day'))) - 8 * 60 * 60 * 1000;
}

export function todayWork(tasks, nowMs = Date.now()) {
  const since = perthDayStartMs(nowMs);
  const completed = (tasks || []).filter(task => task.state === 'done' && !task.piece && Number(task.doneAt) >= since);
  return { completed: completed.length, failed: completed.filter(task => task.error === true).length };
}

export function initDailyWork() {
  const status = document.querySelector('#resetStatus');
  if (!status) return;
  const badge = document.createElement('span');
  badge.id = 'dailyWorkStatus';
  badge.title = 'Completed Agents Office tasks today, Australia/Perth time';
  badge.innerHTML = '<span class="dot"></span><span class="rs-text">TODAY —</span>';
  status.after(badge);

  async function refresh() {
    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      if (!response.ok) throw new Error(`http-${response.status}`);
      const result = todayWork(await response.json());
      const detail = result.failed ? ` · ${result.failed} NEED${result.failed === 1 ? 'S' : ''} REVIEW` : '';
      badge.classList.remove('off');
      badge.querySelector('.rs-text').textContent = `TODAY ${result.completed} TASK${result.completed === 1 ? '' : 'S'} DONE${detail}`;
    } catch {
      badge.classList.add('off');
      badge.querySelector('.rs-text').textContent = 'TODAY WORK UNAVAILABLE';
    }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

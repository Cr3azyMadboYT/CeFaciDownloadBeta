// Home filters start from the sign-up answers; OpenStreetMap credit in Profile; budget gets a free "de la – până la" range with a price warning.
// Each entry is [where, find, replace]; applied after the patches in board-patches.mjs.
const RANGE = `</sc-for>
<div style="display: flex; flex-direction: column; gap: 8px">
<p id="f-range" class="lbl">Sau scrie tu: de la – până la (lei)</p>
<div role="group" aria-labelledby="f-range" style="display: flex; align-items: center; gap: 8px">
<input type="text" inputmode="numeric" maxlength="4" aria-label="De la, în lei" value="{{bMin}}" onChange="{{onBMin}}" placeholder="de la" class="{{bMinCls}}" style="flex: 1 1 0; min-width: 0; height: 42px; padding: 0 14px; text-align: center">
<span aria-hidden="true" style="color: var(--ink2); font-weight: 700">–</span>
<input type="text" inputmode="numeric" maxlength="4" aria-label="Până la, în lei" value="{{bMax}}" onChange="{{onBMax}}" placeholder="până la" class="{{bMaxCls}}" style="flex: 1 1 0; min-width: 0; height: 42px; padding: 0 14px; text-align: center">
</div>
<p class="muted" style="margin: 0">Atenție: prețurile sunt estimate, cam cât dai de persoană. Pot avea o marjă de eroare.</p>
</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<p id="f-vibe"`;

const RANGE_CODE = `closeFilters: () => this.closeFilters(), applyFilters: () => this.applyFilters(),
      ...(() => {
        // the budget range typed in the filter sheet becomes a key like '50-120', registered in BUDGET so the summary reads it
        const key = String((this.state.draft || this.filtersOf()).budget);
        const r = /^(\\d*)-(\\d*)$/.exec(key);
        const cur = r ? [r[1], r[2]] : (key === 'any' ? ['', ''] : ['', key === '0' ? '0' : key]);
        const put = (lo, hi) => {
          lo = String(lo).replace(/\\D/g, '').slice(0, 4); hi = String(hi).replace(/\\D/g, '').slice(0, 4);
          if (!lo && !hi) { this.setDraft('budget', 'any'); return; }
          const k = lo + '-' + hi;
          BUDGET[k] = { label: (lo || '0') + '–' + (hi || '∞'), max: hi ? Number(hi) : 9999, text: lo && hi ? 'între ' + lo + ' și ' + hi + ' lei' : (lo ? 'de la ' + lo + ' lei' : 'până în ' + hi + ' lei') };
          this.setDraft('budget', k);
        };
        return {
          bMin: r ? cur[0] : '', bMax: r ? cur[1] : '',
          bMinCls: r && cur[0] ? 'chip on' : 'chip', bMaxCls: r && cur[1] ? 'chip on' : 'chip',
          onBMin: (e) => put(e && e.target ? e.target.value : '', r ? cur[1] : ''),
          onBMax: (e) => put(r ? cur[0] : '', e && e.target ? e.target.value : ''),
        };
      })(),`;

export const DEMO_BUDGET = [
  ['code', "who: '34', when: 'eve', dur: '23', budget: '100', vibes: ['Fun', 'Competitiv'], dist: '20',", '...APP.homeDefaults(),'],
  ['code', "'Cât de departe, cu mașina?'", "'Cât de departe?'"],
  // budget last, so the typed range sits right under its chips
  ['code', "      { id: 'f-budget', label: 'Buget de persoană, în lei', flex: '0 0 auto', opts: opt('budget', BUDGET, ['0', '50', '100', '200', 'any']) },\n      { id: 'f-dist', label: 'Cât de departe?', flex: '1 1 0', opts: opt('dist', DIST, ['10', '20', '30']) }",
    "      { id: 'f-dist', label: 'Cât de departe?', flex: '1 1 0', opts: opt('dist', DIST, ['10', '20', '30']) },\n      { id: 'f-budget', label: 'Buget de persoană, în lei', flex: '0 0 auto', opts: opt('budget', BUDGET, ['0', '50', '100', '200', 'any']) }"],
  ['code', "closeFilters: () => this.closeFilters(), applyFilters: () => this.applyFilters(),", RANGE_CODE],
  // GDPR: delete the account and everything on the phone; the second tap confirms (same rule as leaving a crew)
  ['code', "tutReplay: () => this.tutStart(true),", "tutReplay: () => this.tutStart(true),\n      delAccLabel: s.accDelArm ? 'Apasă din nou: șterg tot, definitiv' : 'Șterge-mi contul', delAccBg: s.accDelArm ? 'var(--coral-soft, #FFE1DA)' : 'transparent', delAccFg: s.accDelArm ? 'var(--coral-ink, #B3261E)' : 'var(--ink2)',\n      delAccount: () => { if (!this.state.accDelArm) { this.setState({ accDelArm: true }); this.later(() => this.setState({ accDelArm: false }), 5000); return; } APP.deleteAccount(); },"],
  ['code', "resSub: String(s.sq || '').trim().length > 1 ?", "resSub: (String(s.sq || '').trim().length > 1 ?"],
  ['code', "'Niciun loc nu bifează tot ce ai ales.',", "'Niciun loc nu bifează tot ce ai ales.') + APP.priceNote(String(s.sq || ''), String(this.filtersOf().budget)),"],
  ['tpl', '</sc-for>\n<div style="display: flex; flex-direction: column; gap: 8px">\n<p id="f-vibe"', RANGE],
  // ODbL: the venue data must credit OpenStreetMap inside the app (under the tour button, in Profile)
  ['tpl', '<svg class="i s" viewBox="0 0 24 24" aria-hidden="true" style="color: var(--ink3)"><path d="m9 18 6-6-6-6"></path></svg>\n</button>\n</div>\n</sc-if>\n\n<sc-if value="{{isFriends}}"',
    '<svg class="i s" viewBox="0 0 24 24" aria-hidden="true" style="color: var(--ink3)"><path d="m9 18 6-6-6-6"></path></svg>\n</button>\n<button type="button" class="press" onClick="{{delAccount}}" style="margin-top: 18px; align-self: center; height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: {{delAccBg}}; color: {{delAccFg}}; font: 650 14px/1 \'Instrument Sans\', system-ui, sans-serif">{{delAccLabel}}</button>\n<p class="muted" style="margin: 14px 0 0; text-align: center">Datele localurilor: © contribuitorii <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color: inherit">OpenStreetMap</a>, licența ODbL.</p>\n</div>\n</sc-if>\n\n<sc-if value="{{isFriends}}"'],
];

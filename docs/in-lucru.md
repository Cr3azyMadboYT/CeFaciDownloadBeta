# În lucru (23.10) — de reluat dacă se resetează sesiunea

Cornel (23.10, 3 poze): „Am putut crea 2 voturi, am votat amândoi și votul nu s-a terminat; după ce văd notificarea ies
și intru în app și tot apare cu roșu clopoțelul; mereu după ce instalez app și dau conectare cu Google îmi dă crash, dar
doar atunci prima dată; vreau să faci ecranele mai frumoase (votul, Planuri…), pe tematica aplicației”.

- [x] Votul: se închide singur când toți au votat; nu se pot porni 2 voturi deodată cu aceiași oameni
- [x] Clopoțelul: o notificare deschisă (din bara telefonului sau intrând pe ecranul ei) se marchează citită
- [x] Crash la prima intrare cu Google după instalare
- [x] Ecranele mai frumoase (vot, Planuri, …) pe tema CeFaci (bilet galben, Bilu, cer albastru)

Făcut (23.10): migrarea `20261023010000_cefaci_vot_si_clopotel.sql` (aplicată: al doilea vot cu aceiași oameni → îl
deschide pe primul; „Închide votul acum” pentru cine l-a pornit; `notifications_seen`), „Gata, la restul Nu” pe vot;
clopoțelul se stinge la intrarea pe ecranul notificării (`markSeen` în `_layout.tsx`); iconița de anotimp se schimbă abia
după 10 minute în fundal (modulele native `cefaci-icon` / `cefaci-business-icon`); cerul cu Bilu (`ui/SkyHeader.tsx`) și
biletul galben gol (`ui/EmptyTicket.tsx`) pe Vot, Planuri, Notificări, Biletele mele, Prieteni, Setări, FreeNow, Gașca.

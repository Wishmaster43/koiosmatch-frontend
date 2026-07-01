# Multi-Claude coördinatie (COORD-1)

**Probleem (2026-07-01):** meerdere Claude-lanes werkten in **één working tree + één
git-index**. Gevolg: `git add` van lane A pakte staged files van lane B mee in A's
commit, `index.lock`-races, en tijdelijke lokaal↔origin-divergentie. Twee incidenten
op één dag. De PROC-1 pre-commit-gate (`.githooks/pre-commit`) dekt *rode main*, maar
**niet** de index-contaminatie — daarvoor moet elke lane een eigen index hebben.

---

## Fix A — worktree per lane (aanbevolen)

Elke lane krijgt een eigen map + branch + **eigen index** → geen contaminatie meer.
**Danny draait dit één keer** (vanuit de repo-root):

```sh
# committeer eerst eventuele losse WIP in de hoofd-tree, anders blijft die achter
git add -A && git commit -m "wip: snapshot before worktree split"   # of stash

git fetch origin
git worktree add ../km-a1 -b lane/a1 origin/main   # applications · tasks · vacancies · customers
git worktree add ../km-a2 -b lane/a2 origin/main   # ai · auth · dashboard · whatsapp · users · layout
git worktree add ../km-b  -b lane/b  origin/main   # candidates · settings
git worktree add ../km-c  -b lane/c  origin/main   # shiftmanager · reports
```

Dan **elke Claude herstarten met cwd = zijn worktree** (bv. lane A2 in `../km-a2`).
Per lane, de vaste lus:

```sh
git fetch origin && git rebase origin/main   # start schoon
# … werk, commit (pre-commit-gate draait typecheck+lint) …
git push -u origin lane/<x>                   # push je branch
# merge naar main als laatste, één lane tegelijk:
git switch main && git pull && git merge --no-ff lane/<x> && git push && git switch lane/<x>
```

Regels: **stage alleen je eigen files**, `git rebase origin/main` vóór een merge, en
merge **serieel** (één lane tegelijk naar main) zodat conflicten door git worden
afgevangen i.p.v. stil geclobberd.

Opruimen als een lane klaar is: `git worktree remove ../km-<x>`.

---

## Fix B — serialiseren (fallback, geen infra)

Als worktrees niet kunnen: houd **één working tree**, maar **committeer om de beurt**.
- Vóór elke commit: `git status` — commit **alleen je eigen paden expliciet**
  (`git commit pad/naar/file …`, nooit `git add -A`/`git commit -a`).
- Eén lane commit+pusht tegelijk; de andere lanes wachten tot `git fetch` schoon is.
- De PROC-1-gate blijft actief (rode main onmogelijk).

Fix B voorkomt lock-races niet volledig; Fix A is de echte oplossing.

---

## Lane-eigendom (huidig)

| Lane | Branch | Domein |
|---|---|---|
| A1 | `lane/a1` | `pages/{applications,tasks,vacancies,customers}` |
| A2 | `lane/a2` | `pages/{ai,auth,dashboard,whatsapp,users}` · `components/{ai,layout}` |
| B  | `lane/b`  | `pages/candidates` · `pages/settings` |
| C  | `lane/c`  | `pages/shiftmanager` · `components/{shiftmanager,reports}` |
| gedeeld | via PR | `components/{ui,forms,drawer,insights}` · `lib` · `context` · `i18n` |

Gedeelde mappen (ui/lib/context/i18n): raak alleen aan met afstemming; klein + reviewbaar houden.

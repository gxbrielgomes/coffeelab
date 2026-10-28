# ☕ CoffeeLab

Diário de barista pessoal: cadastre seus grãos, registre cada preparo e acompanhe se seu café está ficando melhor.

## Como abrir

- **Siri / Atalhos:** crie um atalho "Coffee Lab" com a ação *Executar Script Shell* → `~/Projetos/coffeelab/abrir.sh`
- **Duplo clique:** `iniciar.command`
- **Terminal:** `./abrir.sh` (liga em segundo plano e abre no Safari) · `./fechar.sh` (desliga)

Não precisa instalar nada: só usa o Python que já vem no Mac. Endereço: http://localhost:5173

## Seus dados

- Banco SQLite + fotos em `data/` (fora do GitHub, está no `.gitignore`)
- Backup local automático em `data/backups/` (últimos 30)
- **Backup no iCloud Drive** em `iCloud Drive/CoffeeLab Backups/`: ao abrir, a cada 10 min se algo mudou e ao fechar (banco, JSON legível e fotos)
- Em **Ajustes** dá pra forçar um backup, baixar ou restaurar um JSON

## Estrutura

```
server.py        backend (Python, sem dependências) + API + SQLite + backups
public/          app (HTML, CSS, JS)
abrir.sh         liga em segundo plano e abre no Safari
fechar.sh        desliga (com backup final)
iniciar.command  abre com dois cliques
```

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Portal do Founder (Qddo)

Frontend (Vite + React + TypeScript) do Portal do Founder/Qddo: reserva de salas, cadastro de founders, desafios, check-in geolocalizado, mural de notícias, etc. Autenticação via Firebase (login Google). O backend (Node/Express + Socket.io + MongoDB) e a infraestrutura da VPS vivem em repositório separado e privado: [Backend-VPS](https://github.com/brendah4nds/Backend-VPS).

## Rodando localmente

**Pré-requisitos:** Node.js

1. Instalar dependências: `npm install`
2. Copiar `.env.example` para `.env` e preencher as credenciais do Firebase e `VITE_API_URL` (aponte para `https://api-staging.qddo.com.br` para não mexer em dados de produção)
3. Rodar: `npm run dev`

## Ambientes

| Branch | Vercel | Backend/API | Banco |
|---|---|---|---|
| `main` | Production | `portal-backend` (produção) | MongoDB de produção |
| `development` | Preview fixo (`portal-qddo-git-development-brendah4nds-projects.vercel.app`) | `portal-backend-staging` (`api-staging.qddo.com.br`) | MongoDB de staging, só dados fictícios |
| outras branches/PRs | Preview efêmero (URL muda a cada deploy) | mesmo staging acima, mas login Google só funciona se o domínio específico da branch for autorizado no Firebase | idem |

`VITE_API_URL` é configurado por ambiente direto no Vercel (Settings → Environment Variables): Production aponta para o backend de produção, Preview aponta para o staging.

Para homologar uma mudança antes de ir para produção: dar merge/push na branch `development` (isso também dispara o deploy do backend de staging no [Backend-VPS](https://github.com/brendah4nds/Backend-VPS)) e testar pela URL fixa de preview acima — os dados lá são sintéticos (ver `seed_staging.js` no repo do backend), então pode testar à vontade sem afetar produção.

### Login com Google em outras branches

Como o Firebase não aceita wildcard em Authorized domains, só a URL fixa da branch `development` está autorizada. Testar login em uma preview de outra branch exige adicionar o domínio específico dela em três lugares: Firebase Console (Authorized domains), CORS do backend (`allowedOrigins` em `backend/src/index.js` no repo Backend-VPS) e, se necessário, `VITE_API_URL` daquele escopo no Vercel.

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

### Deploying to a DigitalOcean Droplet (Docker Compose)

This repo deploys the NestJS API and a dedicated BullMQ worker as separate containers on a persistent droplet.

**What runs on the droplet**
- `api`: NestJS HTTP server (serves `GET /health`)
- `worker`: NestJS application context only (BullMQ processor + repeatable jobs)
- `redis`: self-managed Redis (password required, AOF persistence, no public port)

**One-time droplet setup**
1. Provision a droplet and install Docker + Docker Compose plugin.
2. Create the app directory:
   ```bash
   sudo mkdir -p /opt/errandy_backend
   sudo chown -R $USER:$USER /opt/errandy_backend
   ```
3. Create `/opt/errandy_backend/.env` (do not commit this). It must include at least:
   - `DATABASE_URL=...`
   - `PORT=8080` (the API container maps host port `80` -> container `$PORT`)
   - `REDIS_PASSWORD=...` (required)
   - plus any existing secrets (JWT, payment gateway keys, etc.)

**Cloudflare DNS**
- Create an A record: `api.errandy.com.ng` -> `<droplet_public_ip>` (no automation required).

**How GitHub Actions deploy works**
- On every push to `main`, CI builds one image and pushes **only** the stable tag `:do-latest`.
- CI triggers DigitalOcean registry garbage collection to delete untagged/old manifests (prevents storage growth).
- CI SSHes into the droplet and runs:
  - `docker compose -f docker-compose.prod.yml pull`
  - `docker compose -f docker-compose.prod.yml up -d --remove-orphans`
  - `docker image prune -af` (safe only if the droplet is dedicated)
  - `curl http://localhost/health` (fails the workflow if unhealthy and prints logs)

**Required GitHub secrets**
- Droplet:
  - `DROPLET_HOST` (IP/hostname)
  - `DROPLET_USER` (e.g. `root` or `deploy`)
  - `DROPLET_SSH_KEY` (private key)
- Registry (single repo + single tag strategy):
  - `REGISTRY_HOST` (e.g. `registry.digitalocean.com`)
  - `REGISTRY_USERNAME`
  - `REGISTRY_PASSWORD`
  - `REGISTRY_IMAGE` (e.g. `registry.digitalocean.com/<registry>/<repo>`)
  - `DO_ACCESS_TOKEN` (required for DO registry garbage collection)
- Optional:
  - `HEALTHCHECK_URL` (defaults to `http://localhost/health` on the droplet)

**Redis security posture**
- Redis is not exposed publicly (no published `6379` port).
- Password is required (`REDIS_PASSWORD`).
- Persistence is enabled (AOF + named Docker volume).
- To exec into Redis on the droplet:
  ```bash
  cd /opt/errandy_backend
  docker compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD"
  ```

**Operational notes**
- Droplet sysctl recommendation for Redis:
  - `vm.overcommit_memory=1` (documented by Redis for better background save behavior)
- View logs:
  ```bash
  cd /opt/errandy_backend
  docker compose -f docker-compose.prod.yml logs -f api
  docker compose -f docker-compose.prod.yml logs -f worker
  ```

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

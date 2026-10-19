# CN FE — Docker / ACR / SAE (KAZI-1120)

Intl production remains **Netlify** (`kazispace.ai`).
China entry (`www.kazispace.cn`) runs this image on **Aliyun SAE**, image stored in **ACR**.

## Build (local)

```bash
# from repo root
docker build -t kazispace-ai-cn:local .
docker run --rm -p 3000:3000 kazispace-ai-cn:local
curl -sI http://127.0.0.1:3000/
```

`DOCKER_BUILD=1` is set inside the Dockerfile so `next.config.js` enables `output: 'standalone'` without affecting Netlify.

## Push to ACR (Chengdu economy instance)

Replace login host if your console shows a different registry domain.

```bash
export ACR_HOST=kazispace-ai-cn-registry.cn-chengdu.cr.aliyuncs.com
export ACR_NS=kazispace          # namespace you created
export ACR_REPO=kazispace-ai-cn
export TAG=$(git rev-parse --short HEAD)

docker login "$ACR_HOST"
# username = Aliyun account / RAM login name
# password = Registry fixed password (访问凭证)

docker build -t "$ACR_HOST/$ACR_NS/$ACR_REPO:$TAG" .
docker tag "$ACR_HOST/$ACR_NS/$ACR_REPO:$TAG" "$ACR_HOST/$ACR_NS/$ACR_REPO:latest"
docker push "$ACR_HOST/$ACR_NS/$ACR_REPO:$TAG"
docker push "$ACR_HOST/$ACR_NS/$ACR_REPO:latest"
```

## SAE (lightweight)

1. Create **轻量版** app, deploy via **镜像**.
2. Select `$ACR_HOST/$ACR_NS/$ACR_REPO:$TAG`.
3. Listen port **3000**; instances **1** first; ~1 vCPU / 2 GB.
4. Health check: HTTP `GET /` (or add a dedicated route later).
5. Env: keep `NEXT_PUBLIC_*` in sync with `netlify.toml` if you override at runtime (build-time publics are already baked in).

Optional edge: put `deploy/public-edge/nginx.conf` (+ `rum-ingest.conf`) in front for `/api/rum` rate limits (replaces Netlify edge).

## CDN cutover (later)

Point CDN origin for `www.kazispace.cn` from OSS test page → SAE/SLB.
Keep OSS bucket as rollback origin.

Do **not** host this FE on the Chengdu API ECS.

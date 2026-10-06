# Deploy Hotel Management System lên VPS

## Luồng CI/CD

```
PR vào main ──> CI: lint, test, build, docker build (không push)
                    │  (bắt buộc xanh mới được merge)
merge vào main ──> CD: chạy lại CI ──> build image ──> push GHCR ──> SSH vào VPS
                                                                      ├─ docker compose pull
                                                                      ├─ prisma migrate deploy (chỉ api)
                                                                      └─ docker compose up -d
```

Trên VPS có 2 container:

```
Internet ──:80──> web (nginx) ──/api/*──> api (NestJS :3000, không mở ra ngoài) ──> Neon Postgres
                     └── các route còn lại: file build React (SPA)
```

Hai repo deploy độc lập: đổi FE thì chỉ container `web` khởi động lại, đổi BE thì chỉ container `api`.

---

## Cài đặt lần đầu (chỉ làm 1 lần)

### 1. VPS

Ubuntu 22.04 hoặc 24.04, RAM 1GB là đủ, vì image được build trên GitHub chứ không build trên VPS.

```bash
# Đăng nhập VPS bằng root, rồi:
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/hotel && chown deploy:deploy /opt/hotel

# Tường lửa: chỉ mở SSH và HTTP
ufw allow OpenSSH
ufw allow 80
ufw enable
```

### 2. SSH key cho GitHub Actions

Chạy trên máy của bạn, không phải trên VPS:

```bash
ssh-keygen -t ed25519 -f gh_deploy -N "" -C "github-actions"
```

- Nội dung `gh_deploy.pub`: thêm vào `/home/deploy/.ssh/authorized_keys` trên VPS.
- Nội dung `gh_deploy` (private key): lưu vào GitHub secret `VPS_SSH_KEY`. Sau đó xoá file này khỏi máy.

Thử lại bằng lệnh `ssh -i gh_deploy deploy@IP_VPS`. Vào được là key đã chạy.

### 3. File trên VPS (đăng nhập bằng user `deploy`)

```
/opt/hotel/
├── docker-compose.yml   copy từ repo api/deploy/docker-compose.yml
├── .env                 theo .env.example   (GHCR_OWNER)
└── .env.api             theo .env.api.example (DATABASE_URL, JWT...)
```

```bash
chmod 600 /opt/hotel/.env.api
```

> Đây là lúc nên **đổi mật khẩu Neon** (mật khẩu cũ từng bị lộ). Tạo mật khẩu mới trên Neon, rồi chỉ dán nó vào `.env.api` trên VPS và `.env` ở máy của bạn. Không commit, không gửi qua chat.

### 4. Cho VPS quyền kéo image từ GHCR

Image mặc định là private. Tạo Personal Access Token (classic) chỉ với quyền `read:packages`, rồi đăng nhập trên VPS:

```bash
echo "TOKEN_CUA_BAN" | docker login ghcr.io -u your-github-username --password-stdin
```

### 5. GitHub: làm ở cả 2 repo `api` và `front`

**Settings → Environments → New environment** tên `production`, rồi thêm các secret sau:

| Secret        | Giá trị                            |
| ------------- | ---------------------------------- |
| `VPS_HOST`    | IP của VPS                         |
| `VPS_USER`    | `deploy`                           |
| `VPS_SSH_KEY` | toàn bộ nội dung file `gh_deploy`  |
| `VPS_PORT`    | chỉ cần khi SSH không chạy cổng 22 |

Repo `front`, không bắt buộc: **Variables** → `VITE_API_URL` nếu prefix API khác `/api/v1`.

**Settings → Branches → Add rule** cho `main`: bật _Require a pull request_ và _Require status checks_ (chọn `Lint, test, build` / `Lint, type-check, build`). Từ đây code chưa qua CI thì không merge được.

### 6. Deploy lần đầu

1. Merge vào `main` của **api** trước. CD build xong và chạy migration.
2. Sau đó mới merge **front**.
3. Mở `http://IP_VPS` để kiểm tra.

---

## Sửa code trước khi deploy (BE)

Trong `src/main.ts`, trước `app.listen(...)`:

```ts
// Sau nginx, mọi request đều đến từ IP của nginx -> Throttler chặn nhầm cả khách sạn.
// Dòng này để Express đọc IP thật từ header X-Forwarded-For.
app.getHttpAdapter().getInstance().set('trust proxy', 1);

await app.listen(process.env.PORT ?? 3000);
```

FE: `axiosInstance` phải lấy `baseURL` từ biến môi trường:

```ts
baseURL: import.meta.env.VITE_API_URL;
```

---

## Việc hay làm

```bash
cd /opt/hotel
docker compose ps                    # container nào đang chạy
docker compose logs -f --tail=100 api
docker compose restart api
```

**Rollback** về 1 commit cũ (lấy SHA trong tab Actions hoặc `git log`):

```bash
API_TAG=<commit-sha> docker compose up -d api
WEB_TAG=<commit-sha> docker compose up -d --no-deps web
```

> Rollback chỉ đổi code, **không** hoàn tác migration. Nên viết migration theo kiểu thêm cột hoặc bảng, để bản code cũ vẫn chạy được trên DB mới.

## Lỗi hay gặp

| Triệu chứng                          | Nguyên nhân                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| CI lỗi ở bước Lint ngay lần đầu      | Code cũ còn lỗi ESLint. Chạy `npx eslint src --fix` ở máy rồi sửa phần còn lại                          |
| CI lỗi ở Unit test                   | Các file `*.spec.ts` do `nest g` sinh ra mà chưa mock DI. Xoá chúng hoặc sửa mock                       |
| `denied` khi `docker compose pull`   | VPS chưa `docker login ghcr.io`, hoặc token thiếu quyền `read:packages`                                 |
| `migrate deploy` báo lỗi kết nối     | Đang dùng URL `-pooler` của Neon. Đổi sang URL direct                                                   |
| Container api khởi động lại liên tục | `docker compose logs api`: thường do thiếu biến trong `.env.api`, hoặc `start:prod` trỏ sai `dist/main` |
| Trang FE F5 bị 404                   | Không xảy ra nếu dùng `nginx.conf` này. Kiểm tra image web đã build lại chưa                            |

## Bước tiếp theo (không bắt buộc)

- **HTTPS:** mua tên miền, trỏ về IP VPS, rồi thêm Caddy hoặc certbot phía trước container `web`.
- **Healthcheck:** thêm route `GET /api/v1/health` rồi khai báo `healthcheck` trong compose.

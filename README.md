# Obsidian CI/CD

Obsidian 볼트의 파일 변경을 감시하여 자동으로 Git commit & push(CI)하고, 주기적으로 원격 변경사항을 pull(CD)하는 백그라운드 도구.

## 구조

```
obsidian-ci/
├── config.js            # 볼트 경로, 디바운스, 주기 설정
├── git-sync.js          # git add → commit → push 로직 (CI)
├── git-pull.js          # fetch → pull --rebase → 충돌 시 강제 초기화 (CD)
├── lock.js              # CI/CD 동시 실행 방지 공유 락
├── watcher.js           # chokidar 기반 파일 감시 + pull 스케줄
├── start-watcher.bat    # Node 실행 배치 스크립트 (.env 로드 포함)
├── start-watcher.vbs    # 콘솔 창 숨김 래퍼
├── .env                 # 환경변수 (볼트 경로) — git 추적 안 됨
└── package.json
```

## 동작 방식

### CI (로컬 → 원격)

1. `watcher.js`가 Obsidian 볼트 디렉토리를 감시
2. 파일 추가/변경/삭제 감지 시 **30초 디바운스** 후 동기화 실행
3. `git-sync.js`가 `git add -A` → `git commit` → `git push origin` 수행
4. 커밋 메시지: `auto: 2026-03-01 14:30:00` 형식 (자동 생성)

### CD (원격 → 로컬)

1. 시작 시 즉시 1회, 이후 **5분 주기**로 원격 확인
2. `git fetch` 후 로컬이 뒤처진 경우 `git pull --rebase` 실행
3. 충돌 발생 시 `git rebase --abort` → `git reset --hard origin/<branch>`로 원격 버전 강제 적용
4. 미커밋 변경사항이 있으면 pull 건너뜀 (CI가 먼저 커밋 후 다음 주기에 pull)

### 동시 실행 방지

CI(push)와 CD(pull)는 공유 락(`lock.js`)으로 동시에 실행되지 않는다. 한쪽이 실행 중이면 다른 쪽은 해당 턴을 건너뛴다.

## 설치

### 1. 의존성 설치

```bash
npm install
```

### 2. `.env` 파일 생성

프로젝트 루트에 `.env` 파일을 만들고 자신의 볼트 경로를 입력한다:

```
OBSIDIAN_VAULT_PATH=C:\Users\{사용자}\path\to\obsidian-vault
```

> `.env`는 `.gitignore`에 포함되어 있어 원격 저장소에 올라가지 않는다.
> 미설정 시 `OBSIDIAN_VAULT_PATH 환경변수가 설정되지 않았습니다` 에러가 발생한다.

### 3. 볼트 Git 초기화 (아직 안 했다면)

```bash
cd "볼트 경로"
git init
git remote add origin <원격 저장소 URL>
```

### 사전 요구사항

- Node.js
- Obsidian 볼트 디렉토리가 Git 저장소로 초기화되어 있어야 함
- Git remote(`origin`)이 설정되어 있어야 함

## 설정

`config.js`에서 수정 가능:

| 항목 | 설명 | 기본값 |
|------|------|--------|
| `debounceMs` | 변경 감지 후 push 대기 시간 | `30000` (30초) |
| `pullIntervalMs` | 원격 변경사항 확인 주기 | `300000` (5분) |
| `ignoredPatterns` | 감시 제외 파일 패턴 | `['.obsidian/workspace.json']` |

볼트 경로는 `.env`의 `OBSIDIAN_VAULT_PATH`로 설정한다.

## 실행

### 수동 실행

```bash
npm start
```

### Windows 자동 실행 (Task Scheduler)

Windows 로그인 시 콘솔 창 없이 백그라운드로 자동 실행되도록 설정하는 방법.

#### 시작 스크립트

프로젝트에 포함된 두 파일이 자동 실행을 담당한다:

- **`start-watcher.bat`** — `.env`를 로드하고 `node watcher.js`를 실행하는 배치 스크립트
- **`start-watcher.vbs`** — `.bat`을 숨김 모드(창 없음)로 실행하는 VBScript 래퍼

#### Task Scheduler 등록

프로젝트 디렉토리에서 PowerShell을 **관리자 권한**으로 열고 실행한다:

```powershell
# start-watcher.vbs의 절대 경로를 자동으로 가져온다
$vbs = (Resolve-Path ".\start-watcher.vbs").Path

# 실행할 동작: wscript.exe가 vbs 파일을 실행
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""

# 트리거: Windows 로그인 시 자동 실행
$trigger = New-ScheduledTaskTrigger -AtLogOn

# 설정
# - AllowStartIfOnBatteries: 배터리 모드에서도 실행
# - DontStopIfGoingOnBatteries: 배터리 전환 시 중단하지 않음
# - ExecutionTimeLimit Zero: 시간 제한 없음 (기본 3일 → 해제)
# - RestartCount 3 / RestartInterval 1분: 실패 시 1분 간격 최대 3회 재시작
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Task Scheduler에 등록 (-Force: 같은 이름이 있으면 덮어쓰기)
Register-ScheduledTask -TaskName 'ObsidianCIWatcher' `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Obsidian CI/CD Watcher' -Force
```

> **실행 흐름**: 로그인 → `wscript.exe` → `start-watcher.vbs` → `start-watcher.bat` (.env 로드) → `node watcher.js`
>
> 죽으면 1분 후 자동 재시작, 최대 3회.

#### 등록 확인

```powershell
Get-ScheduledTask -TaskName "ObsidianCIWatcher"
```

`State`가 `Ready`로 나오면 등록 성공.

#### 바로 실행하기

등록만 하면 다음 로그인부터 자동 실행된다. **지금 바로 시작**하려면:

```powershell
Start-ScheduledTask -TaskName "ObsidianCIWatcher"
```

실행 후 `node.exe` 프로세스가 떠 있는지 확인:

```powershell
Get-Process node
```

> Task Scheduler 상태는 `Ready`로 표시되지만 이것은 정상이다.
> 실행 체인이 `wscript.exe` → `vbs` → `bat` → `node` 순서라서,
> Task Scheduler가 추적하는 `wscript.exe`는 즉시 종료되기 때문이다.
> 실제 `node` 프로세스는 백그라운드에서 계속 실행 중이다.

#### Task Scheduler 설정 요약

| 항목 | 값 |
|------|-----|
| 작업 이름 | `ObsidianCIWatcher` |
| 트리거 | 사용자 로그온 시 |
| 실행 시간 제한 | 무제한 |
| 실패 시 재시작 | 1분 간격, 최대 3회 |
| 배터리 실행 | 허용 |

### 수동 제어

```powershell
# 바로 시작 (등록 후 재로그인 전에 실행하고 싶을 때)
Start-ScheduledTask -TaskName "ObsidianCIWatcher"

# 중지 (node 프로세스도 함께 종료하려면 아래 두 줄 모두 실행)
Stop-ScheduledTask -TaskName "ObsidianCIWatcher"
Stop-Process -Name node -ErrorAction SilentlyContinue

# 등록 해제
Unregister-ScheduledTask -TaskName "ObsidianCIWatcher" -Confirm:$false
```

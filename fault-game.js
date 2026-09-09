const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCwGAZQbIfy_ZcYxKCBVWWcq_LTqMTWGAs",
  authDomain: "soclab-fault-game.firebaseapp.com",
  projectId: "soclab-fault-game",
  storageBucket: "soclab-fault-game.firebasestorage.app",
  messagingSenderId: "503173879757",
  appId: "1:503173879757:web:39a609e7d0ccdee9d89684"
};

const DIFFICULTIES = Object.freeze({
  easy: { label: "쉬움", size: 9, mines: 8 },
  normal: { label: "보통", size: 13, mines: 22 },
  hard: { label: "어려움", size: 17, mines: 44 }
});

const elements = {
  nickname: document.getElementById("player-nickname"),
  difficultyInputs: Array.from(document.querySelectorAll('input[name="difficulty"]')),
  startButton: document.getElementById("start-game"),
  resetButton: document.getElementById("reset-game"),
  changeSettingsButton: document.getElementById("change-settings"),
  flagButton: document.getElementById("flag-mode"),
  flagLabel: document.getElementById("flag-mode-label"),
  message: document.getElementById("game-message"),
  boardTitle: document.getElementById("board-title"),
  board: document.getElementById("wafer-board"),
  boardLock: document.getElementById("board-lock"),
  waferShell: document.getElementById("wafer-shell"),
  timer: document.getElementById("game-timer"),
  mineCounter: document.getElementById("mine-counter"),
  leaderboardTitle: document.getElementById("leaderboard-title"),
  leaderboardStatus: document.getElementById("leaderboard-status"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardRefresh: document.getElementById("refresh-leaderboard")
};

const state = {
  selectedDifficulty: "easy",
  difficulty: "easy",
  cells: [],
  cellElements: new Map(),
  phase: "idle",
  nickname: "",
  flagMode: false,
  flaggedCount: 0,
  revealedCount: 0,
  startedAt: 0,
  elapsedMs: 0,
  timerId: null,
  roundId: 0
};

let firebaseServicesPromise = null;
let leaderboardUnsubscribe = null;
let leaderboardRequestId = 0;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDuration(milliseconds) {
  const totalHundredths = Math.max(0, Math.floor(milliseconds / 10));
  const minutes = Math.floor(totalHundredths / 6000);
  const seconds = Math.floor((totalHundredths % 6000) / 100);
  const hundredths = totalHundredths % 100;
  return pad2(minutes) + ":" + pad2(seconds) + "." + pad2(hundredths);
}

function setMessage(text, tone = "") {
  elements.message.textContent = text;
  elements.message.classList.toggle("is-error", tone === "error");
  elements.message.classList.toggle("is-success", tone === "success");
}

function setLeaderboardStatus(text, isError = false) {
  elements.leaderboardStatus.textContent = text;
  elements.leaderboardStatus.classList.toggle("is-error", isError);
}

function getSelectedDifficulty() {
  const selected = elements.difficultyInputs.find((input) => input.checked);
  return selected && DIFFICULTIES[selected.value] ? selected.value : "easy";
}

function getNeighbors(index) {
  const config = DIFFICULTIES[state.difficulty];
  const cell = state.cells[index];
  const neighbors = [];
  if (!cell) {
    return neighbors;
  }

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }
      const row = cell.row + rowOffset;
      const column = cell.column + columnOffset;
      if (row < 0 || column < 0 || row >= config.size || column >= config.size) {
        continue;
      }
      const neighborIndex = row * config.size + column;
      if (state.cells[neighborIndex] && state.cells[neighborIndex].active) {
        neighbors.push(neighborIndex);
      }
    }
  }
  return neighbors;
}

function createCells(difficulty) {
  const config = DIFFICULTIES[difficulty];
  const center = (config.size - 1) / 2;
  const radiusScale = config.size / 2;
  const cells = [];

  for (let row = 0; row < config.size; row += 1) {
    for (let column = 0; column < config.size; column += 1) {
      const x = (column - center) / radiusScale;
      const y = (row - center) / radiusScale;
      cells.push({
        index: row * config.size + column,
        row,
        column,
        active: (x * x) + (y * y) <= 0.92,
        mine: false,
        count: 0,
        revealed: false,
        flagged: false,
        exploded: false
      });
    }
  }
  return cells;
}

function describeCell(cell) {
  const position = (cell.row + 1) + "행 " + (cell.column + 1) + "열";
  if (cell.flagged && !cell.revealed) {
    return position + ", 깃발 표시됨";
  }
  if (!cell.revealed) {
    return position + ", 닫힌 다이";
  }
  if (cell.mine) {
    return position + ", Fault";
  }
  if (cell.count > 0) {
    return position + ", 인접 Fault " + cell.count + "개";
  }
  return position + ", 인접 Fault 없음";
}

function updateCellElement(cell) {
  const element = state.cellElements.get(cell.index);
  if (!element) {
    return;
  }

  element.className = "wafer-cell";
  element.textContent = "";
  element.removeAttribute("data-count");

  if (cell.revealed) {
    element.classList.add("is-revealed");
    if (cell.mine) {
      element.classList.add(cell.exploded ? "is-exploded" : "is-mine");
      element.textContent = "●";
    } else if (cell.count > 0) {
      element.dataset.count = String(cell.count);
      element.textContent = String(cell.count);
    }
  } else if (cell.flagged) {
    element.classList.add("is-flagged");
    element.textContent = "⚑";
  }

  element.setAttribute("aria-label", describeCell(cell));
  element.disabled = state.phase === "idle" || state.phase === "won" || state.phase === "lost";
}

function renderBoard(isLocked) {
  const config = DIFFICULTIES[state.difficulty];
  const fragment = document.createDocumentFragment();
  state.cellElements.clear();
  elements.board.replaceChildren();
  elements.board.style.setProperty("--grid-size", String(config.size));
  elements.board.setAttribute("aria-rowcount", String(config.size));
  elements.board.setAttribute("aria-colcount", String(config.size));

  state.cells.forEach((cell) => {
    if (!cell.active) {
      const outsideCell = document.createElement("span");
      outsideCell.className = "wafer-cell-outside";
      outsideCell.setAttribute("aria-hidden", "true");
      fragment.append(outsideCell);
      return;
    }

    const cellButton = document.createElement("button");
    cellButton.type = "button";
    cellButton.className = "wafer-cell";
    cellButton.dataset.index = String(cell.index);
    cellButton.setAttribute("role", "gridcell");
    cellButton.setAttribute("aria-rowindex", String(cell.row + 1));
    cellButton.setAttribute("aria-colindex", String(cell.column + 1));
    state.cellElements.set(cell.index, cellButton);
    fragment.append(cellButton);
  });

  elements.board.append(fragment);
  state.cells.forEach(updateCellElement);
  elements.boardLock.hidden = !isLocked;
}

function applyDifficultyDisplay(difficulty) {
  const config = DIFFICULTIES[difficulty];
  elements.waferShell.classList.remove("difficulty-easy", "difficulty-normal", "difficulty-hard");
  elements.waferShell.classList.add("difficulty-" + difficulty);
  elements.boardTitle.textContent = config.label;
  elements.leaderboardTitle.textContent = config.label + " Top 10";
  elements.mineCounter.textContent = pad2(config.mines);
}

function stopTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function currentElapsedTime() {
  if (state.phase === "playing") {
    return performance.now() - state.startedAt;
  }
  return state.elapsedMs;
}

function updateTimer() {
  elements.timer.textContent = formatDuration(currentElapsedTime());
}

function beginTimer() {
  state.phase = "playing";
  state.startedAt = performance.now();
  state.elapsedMs = 0;
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 43);
}

function syncFlagButton() {
  elements.flagButton.setAttribute("aria-pressed", String(state.flagMode));
  elements.flagLabel.textContent = "깃발 모드: " + (state.flagMode ? "켬" : "끔");
}

function syncControls() {
  const roundActive = state.phase === "ready" || state.phase === "playing";
  elements.nickname.disabled = roundActive;
  elements.difficultyInputs.forEach((input) => {
    input.disabled = roundActive;
  });
  elements.flagButton.disabled = !roundActive;
  elements.resetButton.disabled = state.phase === "idle";
  elements.changeSettingsButton.disabled = !roundActive;
  elements.startButton.textContent = state.phase === "idle" ? "게임 시작" : "새 게임 시작";
  state.cells.forEach(updateCellElement);
}

function updateMineCounter() {
  const mines = DIFFICULTIES[state.difficulty].mines;
  elements.mineCounter.textContent = pad2(Math.max(0, mines - state.flaggedCount));
}

function preparePreview(difficulty, message = "닉네임과 난이도를 선택한 뒤 게임을 시작해 주세요.") {
  stopTimer();
  state.selectedDifficulty = difficulty;
  state.difficulty = difficulty;
  state.cells = createCells(difficulty);
  state.phase = "idle";
  state.flagMode = false;
  state.flaggedCount = 0;
  state.revealedCount = 0;
  state.elapsedMs = 0;
  applyDifficultyDisplay(difficulty);
  renderBoard(true);
  updateTimer();
  updateMineCounter();
  syncFlagButton();
  syncControls();
  setMessage(message);
}

function normalizeNickname(value) {
  return value.replace(/\s+/g, " ").trim();
}

function rememberNickname(nickname) {
  try {
    window.localStorage.setItem("soclabFaultFinderNickname", nickname);
  } catch (error) {
    // 저장소 접근이 차단되어도 게임 진행에는 영향이 없습니다.
  }
}

function restoreNickname() {
  try {
    const savedNickname = window.localStorage.getItem("soclabFaultFinderNickname");
    if (savedNickname) {
      elements.nickname.value = savedNickname.slice(0, 20);
    }
  } catch (error) {
    // 저장소 접근이 차단된 환경에서는 빈 입력칸을 유지합니다.
  }
}

function startRound() {
  const nickname = normalizeNickname(elements.nickname.value);
  if (!nickname) {
    setMessage("게임을 시작하려면 닉네임을 입력해 주세요.", "error");
    elements.nickname.focus();
    return;
  }
  if (nickname.length > 20) {
    setMessage("닉네임은 20자 이내로 입력해 주세요.", "error");
    elements.nickname.focus();
    return;
  }

  stopTimer();
  state.roundId += 1;
  state.selectedDifficulty = getSelectedDifficulty();
  state.difficulty = state.selectedDifficulty;
  state.nickname = nickname;
  state.cells = createCells(state.difficulty);
  state.phase = "ready";
  state.flagMode = false;
  state.flaggedCount = 0;
  state.revealedCount = 0;
  state.startedAt = 0;
  state.elapsedMs = 0;
  applyDifficultyDisplay(state.difficulty);
  renderBoard(false);
  updateTimer();
  updateMineCounter();
  syncFlagButton();
  syncControls();
  rememberNickname(nickname);
  setMessage("첫 다이를 열면 타이머가 시작됩니다.");
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function placeMines(firstIndex) {
  const config = DIFFICULTIES[state.difficulty];
  const protectedIndices = new Set([firstIndex, ...getNeighbors(firstIndex)]);
  const candidates = state.cells
    .filter((cell) => cell.active && !protectedIndices.has(cell.index))
    .map((cell) => cell.index);

  shuffle(candidates)
    .slice(0, config.mines)
    .forEach((index) => {
      state.cells[index].mine = true;
    });

  state.cells.forEach((cell) => {
    if (cell.active && !cell.mine) {
      cell.count = getNeighbors(cell.index).filter((index) => state.cells[index].mine).length;
    }
  });
}

function toggleFlag(index) {
  if (state.phase !== "ready" && state.phase !== "playing") {
    return;
  }
  const cell = state.cells[index];
  if (!cell || !cell.active || cell.revealed) {
    return;
  }

  const mineLimit = DIFFICULTIES[state.difficulty].mines;
  if (!cell.flagged && state.flaggedCount >= mineLimit) {
    setMessage("사용할 수 있는 깃발을 모두 표시했습니다.");
    return;
  }

  cell.flagged = !cell.flagged;
  state.flaggedCount += cell.flagged ? 1 : -1;
  updateCellElement(cell);
  updateMineCounter();
}

function revealSafeArea(startIndex) {
  const queue = [startIndex];
  const visited = new Set();

  while (queue.length) {
    const index = queue.shift();
    if (visited.has(index)) {
      continue;
    }
    visited.add(index);
    const cell = state.cells[index];
    if (!cell || !cell.active || cell.revealed || cell.flagged || cell.mine) {
      continue;
    }

    cell.revealed = true;
    state.revealedCount += 1;
    updateCellElement(cell);

    if (cell.count === 0) {
      getNeighbors(index).forEach((neighborIndex) => {
        const neighbor = state.cells[neighborIndex];
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) {
          queue.push(neighborIndex);
        }
      });
    }
  }
}

function finishLoss(explodedIndex) {
  state.elapsedMs = currentElapsedTime();
  state.phase = "lost";
  stopTimer();
  state.cells.forEach((cell) => {
    if (cell.mine) {
      cell.revealed = true;
      cell.exploded = cell.index === explodedIndex;
      updateCellElement(cell);
    }
  });
  updateTimer();
  syncControls();
  setMessage("Fault를 찾았습니다. 같은 단계에 다시 도전해 보세요.", "error");
}

async function finishWin() {
  state.elapsedMs = currentElapsedTime();
  state.phase = "won";
  stopTimer();
  state.cells.forEach((cell) => {
    if (cell.mine) {
      cell.flagged = true;
      updateCellElement(cell);
    }
  });
  state.flaggedCount = DIFFICULTIES[state.difficulty].mines;
  updateMineCounter();
  updateTimer();
  syncControls();

  const completedRoundId = state.roundId;
  const score = Math.max(1000, Math.round(state.elapsedMs));
  const nickname = state.nickname;
  const difficulty = state.difficulty;
  setMessage("완료! " + formatDuration(score) + " · 공용 순위표에 기록하는 중입니다.", "success");

  try {
    await saveScore({ nickname, difficulty, elapsedMs: score });
    if (state.roundId === completedRoundId && state.phase === "won") {
      setMessage("완료! " + formatDuration(score) + " · 공용 순위표에 기록되었습니다.", "success");
    }
  } catch (error) {
    console.error("Fault Finder score save failed:", error);
    if (state.roundId === completedRoundId && state.phase === "won") {
      setMessage("게임은 완료했지만 기록을 저장하지 못했습니다. Firebase 설정을 확인해 주세요.", "error");
    }
  }
}

function checkWin() {
  const activeCellCount = state.cells.filter((cell) => cell.active).length;
  const safeCellCount = activeCellCount - DIFFICULTIES[state.difficulty].mines;
  if (state.revealedCount === safeCellCount) {
    finishWin();
  }
}

function revealCell(index) {
  if (state.phase !== "ready" && state.phase !== "playing") {
    return;
  }
  const cell = state.cells[index];
  if (!cell || !cell.active || cell.revealed || cell.flagged) {
    return;
  }

  if (state.phase === "ready") {
    placeMines(index);
    beginTimer();
    syncControls();
  }

  if (cell.mine) {
    finishLoss(index);
    return;
  }

  revealSafeArea(index);
  checkWin();
}

function handleBoardClick(event) {
  const cellButton = event.target.closest(".wafer-cell");
  if (!cellButton || !elements.board.contains(cellButton)) {
    return;
  }
  const index = Number(cellButton.dataset.index);
  if (state.flagMode) {
    toggleFlag(index);
  } else {
    revealCell(index);
  }
}

function handleBoardContextMenu(event) {
  const cellButton = event.target.closest(".wafer-cell");
  if (!cellButton || !elements.board.contains(cellButton)) {
    return;
  }
  event.preventDefault();
  toggleFlag(Number(cellButton.dataset.index));
}

function changeSettings() {
  state.roundId += 1;
  preparePreview(state.selectedDifficulty, "닉네임과 난이도를 다시 선택할 수 있습니다.");
  elements.nickname.focus();
}

function renderLeaderboard(records) {
  elements.leaderboardList.replaceChildren();
  if (!records.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "leaderboard-empty";
    emptyItem.textContent = "아직 등록된 기록이 없습니다. 첫 기록을 남겨보세요.";
    elements.leaderboardList.append(emptyItem);
    return;
  }

  records.slice(0, 10).forEach((record) => {
    const item = document.createElement("li");
    item.className = "leaderboard-entry";

    const nickname = document.createElement("span");
    nickname.className = "leaderboard-name";
    nickname.textContent = record.nickname;
    nickname.title = record.nickname;

    const time = document.createElement("time");
    time.className = "leaderboard-time";
    time.textContent = formatDuration(record.elapsedMs);

    item.append(nickname, time);
    elements.leaderboardList.append(item);
  });
}

async function getFirebaseServices() {
  if (!firebaseServicesPromise) {
    firebaseServicesPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    ]).then(([appModule, authModule, firestoreModule]) => {
      const app = appModule.initializeApp(FIREBASE_CONFIG);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);
      const authReady = auth.currentUser
        ? Promise.resolve(auth.currentUser)
        : authModule.signInAnonymously(auth).then((credential) => credential.user);

      // 인증 실패는 점수 저장 시 명확히 안내하고, 공개 순위표 읽기는 계속 시도합니다.
      authReady.catch(() => {});
      return { authReady, db, firestoreModule };
    });
  }
  return firebaseServicesPromise;
}

async function saveScore({ nickname, difficulty, elapsedMs }) {
  const services = await getFirebaseServices();
  const user = await services.authReady;
  const scores = services.firestoreModule.collection(
    services.db,
    "leaderboards",
    difficulty,
    "scores"
  );
  await services.firestoreModule.addDoc(scores, {
    nickname,
    elapsedMs,
    createdAt: services.firestoreModule.serverTimestamp(),
    uid: user.uid
  });
}

async function subscribeLeaderboard(difficulty) {
  const requestId = ++leaderboardRequestId;
  if (leaderboardUnsubscribe) {
    leaderboardUnsubscribe();
    leaderboardUnsubscribe = null;
  }

  elements.leaderboardTitle.textContent = DIFFICULTIES[difficulty].label + " Top 10";
  elements.leaderboardList.replaceChildren();
  setLeaderboardStatus("공용 순위표를 불러오는 중입니다.");

  try {
    const services = await getFirebaseServices();
    if (requestId !== leaderboardRequestId) {
      return;
    }

    const scores = services.firestoreModule.collection(
      services.db,
      "leaderboards",
      difficulty,
      "scores"
    );
    const topTenQuery = services.firestoreModule.query(
      scores,
      services.firestoreModule.orderBy("elapsedMs", "asc"),
      services.firestoreModule.limit(10)
    );

    leaderboardUnsubscribe = services.firestoreModule.onSnapshot(
      topTenQuery,
      (snapshot) => {
        if (requestId !== leaderboardRequestId) {
          return;
        }
        const records = snapshot.docs
          .map((documentSnapshot) => documentSnapshot.data())
          .filter((record) => (
            typeof record.nickname === "string"
            && Number.isFinite(record.elapsedMs)
            && record.elapsedMs >= 0
          ));
        renderLeaderboard(records);
        setLeaderboardStatus(
          records.length
            ? "현재 " + records.length + "개의 상위 기록입니다."
            : "아직 등록된 기록이 없습니다."
        );
      },
      (error) => {
        console.error("Fault Finder leaderboard load failed:", error);
        if (requestId !== leaderboardRequestId) {
          return;
        }
        renderLeaderboard([]);
        setLeaderboardStatus("순위표를 불러오지 못했습니다. Firebase 설정을 확인해 주세요.", true);
      }
    );
  } catch (error) {
    console.error("Fault Finder Firebase connection failed:", error);
    if (requestId !== leaderboardRequestId) {
      return;
    }
    renderLeaderboard([]);
    setLeaderboardStatus("순위표 서버에 연결하지 못했습니다. 게임은 계속할 수 있습니다.", true);
  }
}

elements.board.addEventListener("click", handleBoardClick);
elements.board.addEventListener("contextmenu", handleBoardContextMenu);

elements.startButton.addEventListener("click", startRound);
elements.resetButton.addEventListener("click", startRound);
elements.changeSettingsButton.addEventListener("click", changeSettings);

elements.flagButton.addEventListener("click", () => {
  if (state.phase !== "ready" && state.phase !== "playing") {
    return;
  }
  state.flagMode = !state.flagMode;
  syncFlagButton();
});

elements.difficultyInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) {
      return;
    }
    state.selectedDifficulty = input.value;
    preparePreview(input.value);
    subscribeLeaderboard(input.value);
  });
});

elements.leaderboardRefresh.addEventListener("click", () => {
  subscribeLeaderboard(state.selectedDifficulty);
});

window.addEventListener("beforeunload", () => {
  stopTimer();
  if (leaderboardUnsubscribe) {
    leaderboardUnsubscribe();
  }
});

restoreNickname();
preparePreview(getSelectedDifficulty());
subscribeLeaderboard(state.selectedDifficulty);

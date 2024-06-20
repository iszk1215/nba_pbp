import { Line, Circle, Chart } from "./chart.js"

const POINTS_BY_ACTION = {
  "freethrow": 1,
  "2pt": 2,
  "3pt": 3,
};
const SECONDS_IN_REGULAR_PERIOD = 12 * 60;
const SECONDS_IN_OVERTIME_PREIOD = 5 * 60;
// const STROKE_STYLE_HOME = "rgb(255, 198, 39)";
// const STROKE_STYLE_AWAY = "rgb(12, 35, 64)";
const STROKE_STYLE_HOME = "rgb(29, 66, 138)";
const STROKE_STYLE_AWAY = "rgb(200, 16, 46)";
const STROKE_STYLE_GRID = "rgb(200, 200, 200)";
const SCORE_RADIUS = 6;
const FONT_FAMILY = "Roboto";

function getElapsed(action) {
  const period = parseInt(action["period"])
  const clock = action["clock"];
  const min = parseInt(clock[2]) * 10 + parseInt(clock[3]);
  const sec = parseInt(clock[5]) * 10 + parseInt(clock[6]);
  const subsec = parseInt(clock[8]) * 0.1 + parseInt(clock[9]) * 0.01;
  const clock_in_sec = min * 60 + sec + subsec;

  if (period < 5) {
    return SECONDS_IN_REGULAR_PERIOD * (period - 1) + SECONDS_IN_REGULAR_PERIOD - clock_in_sec;
  }

  // overtime 
  return SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD - clock_in_sec;
}

function addAxis(chart, boxscore) {
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // grid
  for (let y = 0; y <= chart.maxY; y += ytick)
    chart.addObject(new Line(0, y, chart.maxX, y, 1, STROKE_STYLE_GRID));
  for (let x = 0; x <= chart.maxX; x += xtick)
    chart.addObject(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));

  // overtime
  for (let x = SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD; x <= chart.maxX; x += SECONDS_IN_OVERTIME_PREIOD)
    chart.addObject(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));
}

function addScoreSeries(chart, playbyplay, teamTricode, style) {
  const actions = playbyplay["game"]["actions"]
  if (actions.length == 0)
    return;

  const actionsWithShotResults = actions.filter(
    a => a["shotResult"] && a["teamTricode"] === teamTricode)

  const series = []

  let score = 0;
  let last_score = [0, 0];
  actionsWithShotResults.forEach(action => {
    if (action["shotResult"] && action["teamTricode"] === teamTricode) {
      let fill = false;
      if (action["shotResult"] === "Made") {
        score += POINTS_BY_ACTION[action["actionType"]];
        fill = true;
      }
      const elapsed = getElapsed(action);

      const [x0, y0] = last_score;
      const [x1, y1] = [elapsed, score];
      chart.addObject(new Line(x0, y0, x1, y0, 2, style));
      chart.addObject(new Line(x1, y0, x1, y1, 2, style));

      const circle = new Circle(elapsed, score, SCORE_RADIUS, style, fill, action);
      series.push(circle);
      chart.addObject(circle);

      last_score = [elapsed, score];
    }
  });

  chart.addSeries(series);
}

function drawGuide(ctx, chart, guide) {
  const [cx, cy] = chart.toCanvasXY(guide[0], guide[1]);
  const [seconds, score] = guide;
  ctx.strokeStyle = STROKE_STYLE_GRID;
  chart.drawLineP(ctx, cx, chart.y0, cx, chart.y0 + chart.height);

  let clock;
  let seconds_in_period = seconds;
  if (seconds < SECONDS_IN_REGULAR_PERIOD * 4) {
    while (seconds_in_period > SECONDS_IN_REGULAR_PERIOD) {
      seconds_in_period -= SECONDS_IN_REGULAR_PERIOD;
    }
    clock = SECONDS_IN_REGULAR_PERIOD - seconds_in_period;
  } else {
    seconds_in_period -= SECONDS_IN_REGULAR_PERIOD * 4;
    while (seconds_in_period > SECONDS_IN_OVERTIME_PREIOD) {
      seconds_in_period -= SECONDS_IN_OVERTIME_PREIOD;
    }
    clock = SECONDS_IN_OVERTIME_PREIOD - seconds_in_period;
  }
  const min = String(parseInt(clock / 60)).padStart(2, "0");
  const sec = String(parseInt(clock - 60 * min)).padStart(2, "0");

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${min}:${sec}`, cx, chart.getY(0) + 4);

  // score difference
  const obj0 = chart.series[0].findLast(obj => obj.lx <= seconds);
  const obj1 = chart.series[1].findLast(obj => obj.lx <= seconds);

  let diff = 0, ly0, ly1;
  let latest = null;
  if (obj0 && obj1) {
    latest = obj0.lx > obj1.lx ? obj0 : obj1;
    ly0 = obj0.ly;
    ly1 = obj1.ly;
  } else if (obj0 || obj1) {
    latest = obj0 ? obj0 : obj1;
    ly0 = latest.ly;
    ly1 = chart.getY(0);
  }

  if (latest)
    diff = Math.abs(latest.props["scoreHome"] - latest.props["scoreAway"])

  if (diff > 0) {
    const cy0 = chart.getY(ly0);
    const cy1 = chart.getY(ly1);
    ctx.beginPath();
    ctx.lineWidth = 4;
    chart.drawLineP(ctx, cx, cy0, cx, cy1, 4);
    ctx.stroke()
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${diff}`, cx - 4, (cy0 + cy1) / 2);
  }
}

function draw(ctx, chart, boxscore, guide) {
  // console.log("draw");
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // ctx.clearRect(0, 0, chart.width, chart.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(chart.x0, chart.y0, chart.width, chart.height);

  ctx.strokeStyle = STROKE_STYLE_GRID;

  // axis label
  {
    ctx.font = `14px ${FONT_FAMILY},arial,sans`;
    ctx.fillStyle = "rgb(100, 100, 100)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let y = chart.getY(0) + 4; // 4 = margin

    for (let i = 0; i < 4; ++i) {
      const x = chart.getX(SECONDS_IN_REGULAR_PERIOD * i + SECONDS_IN_REGULAR_PERIOD / 2);
      ctx.fillText(`Q${i + 1}`, x, y);
    }

    // overtime
    for (let i = 4; i < lastPeriod; ++i) {
      const x = chart.getX(SECONDS_IN_REGULAR_PERIOD * 4
        + SECONDS_IN_OVERTIME_PREIOD * (i - 4) + SECONDS_IN_OVERTIME_PREIOD / 2);
      ctx.fillText(`OT${i - 3}`, x, y);
    }

    // y
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let score = 0; score <= chart.maxY; score += ytick) {
      const x = chart.getX(0) - 4;
      y = chart.getY(score);
      ctx.fillText(`${score}`, x, y);
    }
  }

  // guide
  if (guide) {
    drawGuide(ctx, chart, guide);
  }

  chart.objects.sort((a, b) => a.zindex - b.zindex);
  chart.objects.forEach(obj => obj.draw(ctx, chart));
}


function makeTd(text, className) {
  const td = document.createElement("td");
  td.className = `before:content-['${text.replaceAll(" ", "_")}'] `
    + "before:font-bold before:invisible before:block before:h-0"
    + (className ? " " + className : "");
  td.appendChild(document.createTextNode(text));
  return td;
}

function makeBoxscoreElement(team, color, tableColor, mouseEnter, mouseLeave) {
  const headerColor = "bg-" + color;
  const borderColor = "border-" + color;

  const makeTh = (text) => {
    const th = document.createElement("td");
    th.className = "text-center";
    th.appendChild(document.createTextNode(text));
    return th;
  }

  const makeTd = (text, className) => {
    const td = document.createElement("td");
    td.className = `before:content-['${text.replaceAll(" ", "_")}'] `
      + "before:font-bold before:invisible before:block before:h-0"
      + (className ? " " + className : "");
    td.appendChild(document.createTextNode(text));
    return td;
  };

  const caption = document.createElement("caption");
  caption.className = "font-bold";
  caption.append(document.createTextNode(team["teamName"]));

  const header = ["#", "PLAYER", "POS", "MIN", "FGM", "FGA", "FG%", "PTS", "REB", "AST", "TO"];

  const headTr = document.createElement("tr");
  headTr.className = headerColor + " text-white";
  headTr.append(...header.map(text => makeTh(text)));

  const thead = document.createElement("thead");
  thead.className = "font-bold text-sm";
  thead.append(headTr)

  const players = team["players"].filter(player => player["played"] != "0")
  const tbody = document.createElement("tbody");
  tbody.append(...players.map((player, i) => {
    const stats = player["statistics"];
    const fga = stats["fieldGoalsAttempted"];
    const fgm = stats["fieldGoalsMade"];
    const fgp = (fgm / fga * 100).toFixed(1);

    const tdClass = "text-right px-1 font-mono";

    const tr = document.createElement("tr");
    tr.className = "hover:font-bold"
    tr.append(
      makeTd(player["jerseyNum"], tdClass),
      makeTd(player["nameI"], "px-1"),
      makeTd(player["starter"] == "1" ? player["position"] : "", ""),
      makeTd(
        stats["minutes"].replace("PT", "").replace("M", ":").replace(/\..*/, ""),
        tdClass),
      makeTd(fgm.toString(), tdClass),
      makeTd(fga.toString(), tdClass),
      makeTd(fgp.toString(), tdClass),
      makeTd(stats["points"].toString(), tdClass),
      makeTd(stats["reboundsTotal"].toString(), tdClass),
      makeTd(stats["assists"].toString(), tdClass),
      makeTd(stats["turnovers"].toString(), tdClass),
    );

    tr.addEventListener("mouseenter", () => { mouseEnter(player); });
    tr.addEventListener("mouseleave", () => { mouseLeave(player); });

    return tr;
  }));

  const table = document.createElement("table")
  table.className = `table-auto border ${borderColor} ${tableColor}`
  table.append(caption, thead, tbody)

  const root = document.createElement("div");
  root.className = "p-2";
  root.append(table);
  return root;
}

function addBoxscore(parentElement, chart, drawFunc, boxscore, pos, color, tableColor) {
  let selectedPlayer = null;

  const mouseEnter = (player) => {
    // console.log("mouseEnter")
    selectedPlayer = { "player": player, "color": null };

    chart.series.forEach(series => {
      series.forEach(obj => {
        if (obj.props["personId"] == player["personId"]) {
          obj.r = SCORE_RADIUS + 2;
          selectedPlayer.color = obj.primaryStyle;
          // obj.primaryStyle = "rgb(255, 195, 0)";
          obj.primaryStyle = "#93c5fd";
        }
      });
    });
    drawFunc();
  };

  const mouseLeave = (player) => {
    // console.log("mouseLeave")
    chart.series.forEach(series => {
      series.forEach(obj => {
        if (obj.props["personId"] == selectedPlayer.player["personId"]) {
          //console.log(selectedPlayer.color);
          obj.r = SCORE_RADIUS;
          obj.primaryStyle = selectedPlayer.color;
        }
      });
    });
    selectedPlayer = null;
    drawFunc();
  };

  const elem = makeBoxscoreElement(boxscore, color, tableColor, mouseEnter, mouseLeave);
  elem.classList.add("absolute");

  //const parentElement = document.getElementById("pbp-chart");
  parentElement.appendChild(elem);

  const ob = new ResizeObserver((e) => {
    if (pos == "top-left") {
      elem.style.top = `${chart.y0}px`;
      elem.style.left = `${chart.x0}px`;
    } else {
      elem.style.top = `${chart.y0 + chart.height - elem.clientHeight}px`;
      elem.style.left = `${chart.x0 + chart.width - elem.clientWidth}px`;
    }
  });
  ob.observe(elem);
}

function makeActionDialog() {
  const root = document.createElement("div");
  root.className = "p-1 absolute z-10 border-solid border border-black shadow-xl bg-white invisible";

  const description = document.createTextNode("");
  root.appendChild(description);

  const img = document.createElement("img");
  img.width = 26 * 3;
  img.height = 16 * 3;
  root.appendChild(img);

  const dialog = {
    root: root,
    setDescription: (text) => { description.nodeValue = text; },
    setImage: (src) => { img.src = src },
    setVisible: (flag) => {
      if (flag) {
        root.classList.remove("invisible");
        root.classList.add("visible");
      } else {
        root.classList.remove("visible");
        root.classList.add("invisible");
      }
    },
    setAction: (chart, obj, e) => {
      const action = obj.props;
      const src = `https://cdn.nba.com/headshots/nba/latest/260x190/${action["personId"]}.png`;
      dialog.setDescription(action["description"]);
      dialog.setImage(src);
      const [x, y] = chart.toCanvasXY(obj.lx, obj.ly);
      root.style.top = `${y + 10}px`;
      root.style.left = `${x + 10}px`;
    },
  };

  return dialog;
}

function makeActionList(playbyplay, homeTeam, awayTeam) {
  const actions = playbyplay["game"]["actions"];
  console.log(actions);

  const getLogoURL = (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
  const getHeadshotURL = (personId) => `https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`;

  const makeTeamTD = (action) => {
    if ("teamId" in action) {
      const img = document.createElement("img");
      img.src = getLogoURL(action["teamId"]);
      img.width = 24;
      const td = document.createElement("td");
      td.append(img);
      return td;
    }
    return makeTd("")
  };

  const makeHeadshotTD = (action) => {
    if (action["personId"]) {
      const img = document.createElement("img");
      img.src = getHeadshotURL(action["personId"]);
      img.width = 26;
      img.height = 16;

      const td = document.createElement("td");
      td.append(img);
      return td;
    }
    return makeTd("");
  };

  const makeTdIf = (flag, fn) => {
    if (flag)
      return fn();
    return makeTd("");
  };

  const rows = actions.map(action => {
    const tr = document.createElement("tr");
    const isMade = action["shotResult"] == "Made";
    const isMadeHome = isMade && action["teamTricode"] == homeTeam["teamTricode"];
    const isMadeAway = isMade && action["teamTricode"] == awayTeam["teamTricode"];
    tr.append(
      makeTd(`Q${action["period"]}`, "font-mono pr-1"),
      makeTd(action["clock"]
        .replace("PT", "").replace("M", ":").replace(/\..*/, ""),
        "font-mono pr-1"),
      makeTdIf(isMade, () => makeTd(
        action["scoreAway"],
        "text-center font-mono" + (isMadeAway ? " font-bold" : ""))),
      makeTdIf(isMade, () => makeTd("-", "text-center font-mono")),
      makeTdIf(isMade, () => makeTd(
        action["scoreHome"],
        "text-center font-mono" + (isMadeHome ? " font-bold" : ""))),
      makeTeamTD(action),
      makeHeadshotTD(action),
      makeTd(action["description"]),
    );
    tr.id = `action-${action["actionNumber"]}`

    const obj = {
      tr: tr,
      action: action,
      elapsed: getElapsed(action),
    };
    return obj;
  });

  const tbody = document.createElement("tbody");
  tbody.append(...rows.map(row => row.tr));
  const table = document.createElement("table");
  table.append(tbody);
  const root = document.createElement("div")
  root.append(table);
  root.className = "relative overflow-auto text-base"
  root.style.height = "800px" // FIXME

  const findNearest = (elapsed) => {
    let nearestRow = null;
    let nearestShotResultRow = null;
    let last_diff = null;
    let last_diff_shot_result = null;
    for (let row of rows) {
      const d = Math.abs(elapsed - row.elapsed);
      if (last_diff && d < last_diff)
        nearestRow = row;

      if (row.action["shotResult"]) {
        if (last_diff_shot_result && d < last_diff_shot_result)
          nearestShotResultRow = row;
      }

      if (last_diff && last_diff_shot_result && d > last_diff && d > last_diff_shot_result)
        break;

      last_diff = d;
      if (row.action["shotResult"])
        last_diff_shot_result = d;
    }
    console.assert(nearestRow, "nearestRow is not found");
    console.assert(nearestShotResultRow, "nearestShotResultRow is not found");
    return { row: nearestRow, shotResultRow: nearestShotResultRow };
  };

  const findNearestRow = (elapsed) => {
    let diff = null;
    let found = null;
    for (let row of rows) {
      found = row;
      const d = elapsed - row.elapsed;
      if (d < 0)
        break;
    }
    return found;
  };

  const obj = {
    root: root,
    scrollIntoElapsed: (elapsed) => {
      const row = findNearestRow(elapsed);
      row.tr.scrollIntoView({ block: "center" });
    },
    scrollIntoRow: (row) => {
      row.tr.scrollIntoView({ block: "center" });
    },
    findNearest: findNearest,
  };
  return obj;
}

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function initChart(root, playbyplay, boxscore, widgets, canvas, ctx) {
  const chart_x0 = 50;
  const chart_y0 = 20;
  const chart_width = canvas.width - 60;
  const chart_height = canvas.height - 100;

  const lastPeriod = boxscore["game"]["period"];

  const maxScore = getMaxScore(playbyplay)
  const maxX = 4 * SECONDS_IN_REGULAR_PERIOD + (lastPeriod - 4) * SECONDS_IN_OVERTIME_PREIOD;
  const maxY = Math.ceil(maxScore / 20) * 20;

  const chart = new Chart(chart_x0, chart_y0, chart_width, chart_height, maxX, maxY)

  const teamTricodeAway = boxscore["game"]["awayTeam"]["teamTricode"]
  const teamTricodeHome = boxscore["game"]["homeTeam"]["teamTricode"]

  addAxis(chart, boxscore);
  addScoreSeries(chart, playbyplay, teamTricodeAway, STROKE_STYLE_AWAY);
  addScoreSeries(chart, playbyplay, teamTricodeHome, STROKE_STYLE_HOME);

  canvas.addEventListener("mouseleave", (e) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, chart, boxscore, null);
  });

  const onMouseLeave = (obj, e) => {
    obj.r = SCORE_RADIUS;
    widgets.actionDialog.setVisible(false);
  }

  const onMouseEnter = (obj, e) => {
    obj.r = SCORE_RADIUS + 2;
    widgets.actionDialog.setAction(chart, obj, e);
    widgets.actionDialog.setVisible(true);
  };

  const onMouseMove = (e) => {
    const [cx, cy] = [e.offsetX, e.offsetY];
    // const [lx, ly] = chart.toLogical(cx, cy);

    let minDistance = cx;
    let nearestCircle = null;

    chart.objects.forEach(obj => {
      if (obj.isin) { // FIXME: if circle
        const d = Math.abs(cx - chart.getX(obj.lx));
        if (d < obj.r && d < minDistance) {
          minDistance = d;
          nearestCircle = obj;
        }
      }
    });

    chart.objects.forEach(obj => {
      if (obj != nearestCircle && obj.isMouseOn) {
        obj.isMouseOn = false;
        onMouseLeave(obj, e);
      }
    });

    if (nearestCircle) {
      nearestCircle.isMouseOn = true;
      onMouseEnter(nearestCircle, e);
    }
  }

  canvas.addEventListener("mousemove", (e) => {
    // console.log("mousemove")
    const [cx, cy] = [e.offsetX, e.offsetY];
    const [lx, ly] = chart.toLogical(cx, cy);

    // console.log(x, y);
    let guide = null;
    if (chart.isin(cx, cy)) {
      guide = [lx, ly];
      onMouseMove(e)
    }

    const nearest = widgets.actionList.findNearest(lx);
    const diff = Math.abs(nearest.shotResultRow.elapsed - lx);
    widgets.actionList.scrollIntoRow(nearest.row);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, chart, boxscore, guide);
  });

  WebFont.load({
    google: {
      families: [FONT_FAMILY],
    },
    active: function() {
      draw(ctx, chart, boxscore);
    },
  });


  const homeTeam = boxscore["game"]["homeTeam"];
  const awayTeam = boxscore["game"]["awayTeam"];
  const callback = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, chart, boxscore);
  };
  addBoxscore(root, chart, callback, homeTeam, "top-left", "blue-800", "bg-blue-50");
  addBoxscore(root, chart, callback, awayTeam, "bottom-right", "rose-700", "bg-rose-50");
}

function init(playbyplay, boxscore) {
  console.log(playbyplay)
  console.log(boxscore)

  console.log(playbyplay["game"]["gameId"])
  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const homeTeam = boxscore["game"]["homeTeam"];
  const awayTeam = boxscore["game"]["awayTeam"];

  const parentElement = document.getElementById("pbp-chart");
  console.log(parentElement.clientWidth)
  console.log(parentElement.clientHeight)

  const width = parentElement.clientWidth;
  const height = parentElement.clientHeight;

  // const root = document.getElementById("pbp-chart");
  const root = document.createElement("div");
  root.className = "relative";
  root.style.width = `${width}px`;
  root.style.height = `${height}px`;

  const actionDialog = makeActionDialog();
  root.appendChild(actionDialog.root);

  const actionList = makeActionList(playbyplay, homeTeam, awayTeam);
  const tmp = parentElement.parentElement;
  tmp.appendChild(actionList.root);

  const canvas = document.createElement("canvas");
  canvas.className = "absolute";
  canvas.width = width;
  canvas.height = height;
  root.appendChild(canvas);

  const widgets = {
    actionDialog: actionDialog,
    actionList: actionList,
  };

  // const canvas = document.getElementById("pbp");
  if (canvas.getContext) {
    const ctx = canvas.getContext("2d");
    initChart(root, playbyplay, boxscore, widgets, canvas, ctx);
  }

  parentElement.append(root);
}

export function start(playbyplay, boxscore) {
  init(playbyplay, boxscore);
}

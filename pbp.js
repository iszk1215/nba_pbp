// import _playbypay from "./0042300232.json" with {type: "json"}
// import _playbypay from "./0042300224.json" with {type: "json"}
// import _playbypay from "./0042300237_playbyplay.json" with {type: "json"}
// import _boxscore from "./0042300237_boxscore.json" with {type: "json"}
// import _playbypay from "./0042300301_playbyplay.json" with {type: "json"}
// import _boxscore from "./0042300301_boxscore.json" with {type: "json"}
import _playbypay from "./data/0042300312_playbyplay.json" with {type: "json"}
import _boxscore from "./data/0042300312_boxscore.json" with {type: "json"}

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

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
};

class Line {
  constructor(chart, x0, y0, x1, y1, lineWidth, strokeStyle) {
    const [cx0, cy0] = chart.toCanvasXY(x0, y0);
    const [cx1, cy1] = chart.toCanvasXY(x1, y1);
    this.p0 = new Point(cx0, cy0);
    this.p1 = new Point(cx1, cy1);
    this.lineWidth = lineWidth;
    this.strokeStyle = strokeStyle;
  }

  draw(ctx) {
    const offset = 0; // this.lineWidth / 2;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.moveTo(this.p0.x + offset, this.p0.y + offset);
    ctx.lineTo(this.p1.x + offset, this.p1.y + offset);
    ctx.stroke();
  }
};

class Circle {
  constructor(px, py, r, fillStyle, strokeStyle, props) {
    this.px = px;
    this.py = py;
    this.r = r; // phisical
    this.fillStyle = fillStyle;
    this.strokeStyle = strokeStyle;
    this.isMouseOn = false;
    this.props = props;
  }

  isin(px, py) {
    const d = (this.px - px) * (this.px - px) + (this.py - py) * (this.py - py);
    return d < this.r * this.r;
  }

  draw(ctx) {
    const [x, y, r] = [this.px, this.py, this.r];
    if (this.strokeStyle) {
      ctx.fillStyle = this.strokeStyle;
      // ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.fillStyle;
      ctx.beginPath();
      ctx.arc(x, y, r - 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = this.fillStyle;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class Chart {
  constructor(x0, y0, width, height, maxX, maxY) {
    this.x0 = x0;
    this.y0 = y0;
    this.width = width;
    this.height = height;
    this.maxX = maxX;
    this.maxY = maxY;
    this.series = [];
    this.objects = [];
  }

  addObject(obj) {
    this.objects.push(obj);
  }

  addSeries(series) {
    this.series.push(series);
  }

  isin(px, py) {
    return px >= this.x0 && px < this.x0 + this.width
      && py >= this.y0 && py < this.y0 + this.height;
  }

  toLogicalX(x) {
    return (x - this.x0) * this.maxX / this.width;
  }

  toLogicalY(y) {
    // return parseInt((this.y0 + this.height - y) * this.maxY / this.height);
    return (this.y0 + this.height - y) * this.maxY / this.height;
  }

  toLogical(x, y) {
    return [this.toLogicalX(x), this.toLogicalY(y)];
  }

  getX(x) {
    // return parseInt(this.x0 + this.width * x / this.maxX);
    return this.x0 + this.width * x / this.maxX;
  }

  getY(y) {
    // return parseInt(this.y0 + this.height - this.height * y / this.maxY);
    return this.y0 + this.height - this.height * y / this.maxY;
  }

  toCanvasXY(x, y) {
    return [this.getX(x), this.getY(y)]
  }

  drawLineP(ctx, x0, y0, x1, y1, lineWidth) {
    const offset = 0; lineWidth / 2;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0 + offset, y0 + offset);
    ctx.lineTo(x1 + offset, y1 + offset);
    ctx.stroke();
  }

  drawLine(ctx, x0, y0, x1, y1, lineWidth) {
    const [cx0, cy0] = this.toCanvasXY(x0, y0);
    const [cx1, cy1] = this.toCanvasXY(x1, y1);
    this.drawLineP(ctx, cx0, cy0, cx1, cy1, lineWidth);
  }
} // class Chart

function getElapsed(action) {
  const period = parseInt(action["period"])
  const clock = action["clock"];
  const min = parseInt(clock[2]) * 10 + parseInt(clock[3]);
  const sec = parseInt(clock[5]) * 10 + parseInt(clock[6]);
  const subsec = parseInt(clock[8]) * 0.1 + parseInt(clock[9]) * 0.01;
  const clock_in_sec = min * 60 + sec + subsec;
  if (period < 5) {
    return SECONDS_IN_REGULAR_PERIOD * (period - 1) + SECONDS_IN_REGULAR_PERIOD - clock_in_sec;
  } else { // overtime 
    return SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD - clock_in_sec;
  }
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
      const made = action["shotResult"] === "Made";
      let strokeStyle = style;
      let radius = SCORE_RADIUS;
      if (action["shotResult"] === "Made") {
        score += POINTS_BY_ACTION[action["actionType"]];
        strokeStyle = null;
        radius = SCORE_RADIUS;
      }
      const elapsed = getElapsed(action);
      const x = chart.getX(elapsed);
      const y = chart.getY(score);
      const fillStyle = made ? style : "rgb(255, 255, 255)";

      series.push(new Circle(x, y, radius, fillStyle, strokeStyle, action));

      const [x0, y0] = last_score;
      const [x1, y1] = [elapsed, score];
      chart.addObject(new Line(chart, x0, y0, x1, y0, 2, style));
      chart.addObject(new Line(chart, x1, y0, x1, y1, 2, style));


      last_score = [elapsed, score];
    }
  });

  chart.addSeries(series);
}

function drawPoints(chart, ctx, series, strokeStyle) {
  ctx.strokeStyle = strokeStyle;

  series.forEach(obj => {
    obj.draw(ctx);
  });
}

function draw(ctx, chart, playbyplay, boxscore, guide) {
  // console.log("draw");
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // ctx.clearRect(0, 0, chart.width, chart.height);

  ctx.strokeStyle = STROKE_STYLE_GRID;

  // grid
  for (let y = 0; y <= chart.maxY; y += ytick)
    chart.drawLine(ctx, 0, y, chart.maxX, y, 1);
  for (let x = 0; x <= chart.maxX; x += xtick)
    chart.drawLine(ctx, x, 0, x, chart.maxY, 1);

  // overtime
  for (let x = SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD; x <= chart.maxX; x += SECONDS_IN_OVERTIME_PREIOD)
    chart.drawLine(ctx, x, 0, x, chart.maxY, 1);

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
    const [x, y] = guide;
    const [seconds, score] = chart.toLogical(x, y);
    ctx.strokeStyle = STROKE_STYLE_GRID;
    chart.drawLineP(ctx, x, chart.y0, x, chart.y0 + chart.height);

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
    ctx.fillText(`${min}:${sec}`, x, chart.getY(0) + 4);

    // score difference
    const obj0 = chart.series[0].findLast(obj => obj.px <= x);
    const obj1 = chart.series[1].findLast(obj => obj.px <= x);

    let diff = 0, py0, py1;
    let latest = null;
    if (obj0 && obj1) {
      latest = obj0.px > obj1.px ? obj0 : obj1;
      py0 = obj0.py;
      py1 = obj1.py;
    } else if (obj0 || obj1) {
      latest = obj0 ? obj0 : obj1;
      py0 = latest.py;
      py1 = chart.getY(0);
    }

    if (latest)
      diff = Math.abs(latest.props["scoreHome"] - latest.props["scoreAway"])

    if (diff > 0) {
      ctx.beginPath();
      ctx.lineWidth = 4;
      chart.drawLineP(ctx, x, py0, x, py1, 4);
      ctx.stroke()
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${diff}`, x - 4, (py0 + py1) / 2);
    }
  }

  chart.objects.forEach(obj => obj.draw(ctx));

  drawPoints(chart, ctx, chart.series[0], STROKE_STYLE_AWAY)
  drawPoints(chart, ctx, chart.series[1], STROKE_STYLE_HOME)
}


function makeBoxscoreElement(boxscore) {
  const root = document.createElement("div");
  root.className = "bg-white";

  const makeTh = (text) => {
    const th = document.createElement("td");
    th.className = "font-bold text-center";
    th.appendChild(document.createTextNode(text));
    return th;
  }

  const makeTd = (text, className) => {
    const td = document.createElement("td");
    td.className = `before:content-['${text.replaceAll(" ", "_")}'] before:font-bold before:invisible before:block before:h-0`;
    if (className)
      td.className += " " + className;
    // td.className += " border-y-2 border-transparent hover:border-y-2 hover:border-black";
    td.appendChild(document.createTextNode(text));
    return td;
  };

  const team = boxscore["game"]["awayTeam"];

  const border_colors = ["border-red-300", "border-blue-300", "border-green-300"];

  const table = document.createElement("table")
  table.className = "table-auto border-2";
  // table.className = "border-2 border-separate border-spacing-1 text-base";
  // table.style = "border-color: #124D8A; background: #124D8A; color: white;";
  // table.style = "border-color: #124D8A; background: #C8102A; color: white;";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  tr.append(makeTh("#"));
  tr.append(makeTh("Name"));
  tr.append(makeTh("MIN"));
  tr.append(makeTh("FGM"));
  tr.append(makeTh("FGA"));
  tr.append(makeTh("FG%"));
  tr.append(makeTh("PTS"));
  thead.append(tr)

  const caption = document.createElement("caption");
  caption.append(document.createTextNode(boxscore["game"]["awayTeam"]["teamName"]));

  table.append(caption)
  table.append(thead);

  const tbody = document.createElement("tbody");
  team["players"].forEach((player, i) => {
    if (player["played"] === "0")
      return;

    const stats = player["statistics"];
    const fga = stats["fieldGoalsAttempted"];
    const fgm = stats["fieldGoalsMade"];
    const fgp = (fgm / fga).toFixed(2) * 100;

    const tr = document.createElement("tr");
    // tr.className = "hover:font-bold hover:border-2 hover:border-black border-2 " + border_colors[i % 3];
    tr.className = "hover:font-bold"
    tr.append(makeTd(player["jerseyNum"], "text-right px-1 font-mono"));
    tr.append(makeTd(player["nameI"], "px-1"));
    tr.append(makeTd(player["statistics"]["minutes"].replace("PT", "").replace("M", ":").replace(/\..*/, ""), "text-right font-mono"));
    tr.append(makeTd(fgm.toString(), "text-right px-1 font-mono"));
    tr.append(makeTd(fga.toString(), "text-right px-1 font-mono"));
    tr.append(makeTd(fgp.toString(), "text-right px-1 font-mono"));
    tr.append(makeTd(player["statistics"]["points"].toString(), "text-right px-1 font-mono"));

    tbody.append(tr);
  });
  table.append(tbody);

  root.append(table);
  return root;
}

function addBoxscore(chart, drawFunc, boxscore) {
  const elem = makeBoxscoreElement(boxscore);

  elem.classList.add("absolute");
  // elem.classList.add("top-48");
  // elem.classList.add("left-16");

  elem.style.top = "70px";
  elem.style.left = "64px";

  elem.addEventListener("mouseenter", (ev) => {
    // console.log("mouseenter");
    chart.series.forEach(series => {
      series.forEach(obj => {
        if (obj.props["personId"] == 1630162) {
          obj.r = SCORE_RADIUS + 2;
        }
      });
    });
    drawFunc();
  });

  elem.addEventListener("mouseleave", (ev) => {
    //console.log("mouseleave");
    chart.series.forEach(series => {
      series.forEach(obj => {
        obj.r = SCORE_RADIUS;
      });
    });
    drawFunc();
  });

  const parentElement = document.getElementById("pbp-chart");
  parentElement.appendChild(elem);
}

function makeActionDialog() {
  const root = document.createElement("div");
  const img = document.createElement("img");
  root.appendChild(img);

  const description = document.createTextNode("");
  root.appendChild(description);

  const baseClass = "absolute z-10 border-solid border border-black shadow-xl bg-white"

  root.className = baseClass + " invisible";
  img.width = 26 * 3;
  img.height = 16 * 3;

  const obj = {
    root: root,
    setDescription: (text) => {
      description.nodeValue = text;
    },
    setImage: (src, x, y) => {
      img.src = src
      root.style.top = `${y}px`;
      root.style.left = `${x}px`;
    },
    setVisible: (flag) => {
      if (flag) {
        root.classList.remove("invisible");
        root.classList.add("visible");
      } else {
        root.classList.remove("visible");
        root.classList.add("invisible");
      }
    },
    setAction: (action, e) => {
      const src = `https://cdn.nba.com/headshots/nba/latest/260x190/${action["personId"]}.png`;
      obj.setDescription(action["description"]);
      obj.setImage(src, e.screenX, e.screenY);
    },
  };

  return obj;
}

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function initChart(playbyplay, boxscore, actionDialog, canvas, ctx) {
  canvas.width = 1900;
  canvas.height = 900;

  const chart_x0 = 50;
  const chart_y0 = 50;
  const chart_width = 1200;
  const chart_height = 800;

  const lastPeriod = boxscore["game"]["period"];

  const maxScore = getMaxScore(playbyplay)
  const maxX = 4 * SECONDS_IN_REGULAR_PERIOD + (lastPeriod - 4) * SECONDS_IN_OVERTIME_PREIOD;
  // const maxY = Math.max(maxScore, 120)
  const maxY = Math.ceil(maxScore / 20) * 20;

  const chart = new Chart(chart_x0, chart_y0, chart_width, chart_height, maxX, maxY)

  const teamTricodeAway = boxscore["game"]["awayTeam"]["teamTricode"]
  const teamTricodeHome = boxscore["game"]["homeTeam"]["teamTricode"]

  addScoreSeries(chart, playbyplay, teamTricodeAway, STROKE_STYLE_AWAY);
  addScoreSeries(chart, playbyplay, teamTricodeHome, STROKE_STYLE_HOME);

  const headshots = {};
  const imageLoaded = {};

  canvas.addEventListener("mouseleave", (e) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, chart, playbyplay, boxscore, null);
  });

  const onMouseLeave = (obj, e) => {
    obj.r = SCORE_RADIUS;
    actionDialog.setVisible(false);
  }

  const onMouseEnter = (obj, e) => {
    obj.r = SCORE_RADIUS + 2;
    actionDialog.setAction(obj.props, e);
    actionDialog.setVisible(true);
  };

  canvas.addEventListener("mousemove", (e) => {
    // console.log("mousemove")
    const [x, y] = [e.offsetX, e.offsetY];
    // console.log(x, y);
    let guide = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (chart.isin(x, y)) {
      guide = [x, y];

      let objOnMouse = null;

      chart.series.forEach(series => {
        series.forEach(obj => {
          if (obj.isin(x, y)) {
            objOnMouse = obj;
          } else if (obj.isMouseOn) {
            obj.isMouseOn = false;
            onMouseLeave(obj, e);
          }
        })
      })

      if (objOnMouse) {
        const obj = objOnMouse;
        obj.isMouseOn = true;
        onMouseEnter(obj, e);
      }
    }

    draw(ctx, chart, playbyplay, boxscore, guide);
    // console.log("mousemove done")
  });

  WebFont.load({
    google: {
      families: [FONT_FAMILY],
    },
    active: function() {
      draw(ctx, chart, playbyplay, boxscore);
    },
  });


  addBoxscore(chart, () => { draw(ctx, chart, playbyplay, boxscore); }, boxscore);
}

function init(playbyplay, boxscore) {
  console.log(playbyplay)
  console.log(boxscore)

  console.log(playbyplay["game"]["gameId"])
  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const root = document.getElementById("pbp-chart");
  root.className = "relative border";

  const actionDialog = makeActionDialog();
  root.appendChild(actionDialog.root);

  const canvas = document.createElement("canvas");
  canvas.className = "absolute";
  root.appendChild(canvas);

  // const canvas = document.getElementById("pbp");
  if (canvas.getContext) {
    const ctx = canvas.getContext("2d");
    initChart(playbyplay, boxscore, actionDialog, canvas, ctx);
  }

  const box = document.getElementById("box");
  // box.className = "hidden";
}

init(_playbypay, _boxscore)

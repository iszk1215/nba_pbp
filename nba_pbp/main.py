import argparse
import glob
from datetime import datetime
import json
import logging
import os

import dateutil.parser

from jinja2 import Environment, FileSystemLoader

from nba_pbp.make import make_players_on_court
from nba_pbp.client import NBAAPIClient, parse_result_sets, parse_row_set

_logger = logging.getLogger(__name__)


class Team:
    def __init__(self, tricode, score):
        self.tricode = tricode
        self.score = score

    @staticmethod
    def from_json(js):
        return Team(js["teamTricode"], js["score"])


class Game:
    def __init__(self, game_id, game_time_local, game_status, home_team, away_team):
        self.game_id = game_id
        self.game_time_local = game_time_local
        self.game_status = game_status
        self.home_team = home_team
        self.away_team = away_team


class Config:
    def __init__(self):
        self.base_url = "/"


def generate_play_by_play(output, boxscore):
    config = Config()
    awayTeam = Team.from_json(boxscore["game"]["awayTeam"])
    homeTeam = Team.from_json(boxscore["game"]["homeTeam"])

    dt = dateutil.parser.parse(boxscore["game"]["gameTimeLocal"])

    with open(output, "w") as f:
        env = Environment(loader=FileSystemLoader("."))
        templ = env.get_template("template.html")
        f.write(
            templ.render(
                config=config,
                gameId=boxscore["game"]["gameId"],
                awayTeam=awayTeam,
                homeTeam=homeTeam,
                gameTime=dt.strftime("%a %b %d"),
            )
        )


def get_games_of_day(client, date):
    score = parse_result_sets(client.get_scoreboard_v2(date)["resultSets"])
    game_headers = parse_row_set(score["GameHeader"])
    return [header["GAME_ID"] for header in game_headers]


def generate_game(client, game_id, directory):
    pbp = client.get_playbyplay(game_id)
    boxscore = client.get_boxscore(game_id)
    poc = make_players_on_court(pbp, boxscore)

    os.makedirs(directory, exist_ok=True)

    with open(os.path.join(directory, "playbyplay.json"), "w") as f:
        f.write(json.dumps(pbp))

    with open(os.path.join(directory, "boxscore.json"), "w") as f:
        f.write(json.dumps(boxscore))

    with open(os.path.join(directory, "poc.json"), "w") as f:
        f.write(json.dumps(poc))

    filename = os.path.join(directory, "index.html")
    generate_play_by_play(filename, boxscore)


def generate_index(games, directory):
    env = Environment(loader=FileSystemLoader("."))
    templ = env.get_template("index.html")

    days = {}

    for game in games:
        if game.game_status != 3:
            continue
        day = game.game_time_local.strftime("%Y-%m-%d")
        print(day)
        if day not in days:
            days[day] = []
        days[day] += [game]

    games = [game for game in games if game.game_status == 3]
    with open(os.path.join(directory, "index.html"), "w") as f:
        f.write(templ.render(games=days))


def parse_boxscore(data):
    game = data["game"]
    game_time_local = dateutil.parser.parse(game["gameTimeLocal"])
    home_team = Team.from_json(game["homeTeam"])
    away_team = Team.from_json(game["awayTeam"])
    print(f"{game['gameId']} {home_team.tricode=} {away_team.tricode=}")
    return Game(
        game_id=game["gameId"],
        game_time_local=game_time_local,
        game_status=game["gameStatus"],
        home_team=home_team,
        away_team=away_team,
    )


def scan_boxscores(directory):
    files = glob.glob(os.path.join(directory, "*", "boxscore.json"))
    # print(files)

    games = []
    for file in files:
        with open(file) as f:
            data = json.load(f)
            games += [parse_boxscore(data)]

    return games


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", "-d", default=None)
    parser.add_argument("--output-directory", "-o", default="public")
    parser.add_argument("--game", action="store_true")
    parser.add_argument("--update-index", action="store_true")
    parser.add_argument("--download-games", action="store_true")
    parser.add_argument("--generate-game", default=None)
    parser.add_argument("--cache-dir", default=".cache")
    parser.add_argument("--force", "-f", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.update_index:
        games = scan_boxscores(os.path.join(args.output_directory, "games"))
        generate_index(games, args.output_directory)

    if args.download_games:
        if args.date is None:
            date = datetime.today()
        else:
            date = dateutil.parser.parse(args.date)

        client = NBAAPIClient(args.cache_dir)
        game_ids = get_games_of_day(client, date.strftime("%Y-%m-%d"))
        for game_id in game_ids:
            path = os.path.join(args.output_directory, "games", game_id)
            if not os.path.exists(path) or args.force:
                generate_game(client, game_id, path)
            else:
                _logger.info(f"{path} already exists")

    if args.generate_game:
        client = NBAAPIClient(args.cache_dir)
        game_id = args.generate_game
        path = os.path.join(args.output_directory, "games", game_id)
        generate_game(client, game_id, path)


if __name__ == "__main__":
    main()

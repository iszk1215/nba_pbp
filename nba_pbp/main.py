import argparse
import glob
from datetime import datetime
import json
import os

import dateutil.parser

from nba_api.live.nba.endpoints import playbyplay, boxscore
from nba_api.stats.endpoints import ScoreboardV2

# from nba_api.stats.endpoints import boxscoreadvancedv3, scoreboardv2, playbyplayv3, playbyplayv2
# import nba_on_court as noc

from jinja2 import Environment, FileSystemLoader


from nba_pbp.make import make_play_by_play, make_players_on_court


class NBAAPIClient:
    def __init__(self, cache_dir):
        self.cache_dir = cache_dir

    def get_scoreboard_v2(self, date: str):
        cache_path = os.path.join(self.cache_dir, "scoreboard", f"{date}.json")

        def parse_data_sets(data_sets):
            return {
                result_set["name"]: {
                    "headers": result_set["headers"],
                    "data": result_set["rowSet"],
                }
                for result_set in data_sets["resultSets"]
            }

        try:
            with open(cache_path) as f:
                data_sets = json.load(f)
        except Exception:
            score = ScoreboardV2(game_date=date)
            with open(cache_path, "w") as f:
                print(f"write to {cache_path}")
                f.write(score.get_json())

            data_sets = json.loads(score.get_json())

        return parse_data_sets(data_sets)

    def get_playbyplay(self, game_id):
        cache_path = os.path.join(self.cache_dir, "playbyplay", f"{game_id}.json")

        try:
            with open(cache_path) as f:
                data = json.load(f)
            print(f"load from cache: {cache_path}")
        except Exception:
            json_str = playbyplay.PlayByPlay(game_id).get_json()
            print(f"write to {cache_path}")
            with open(cache_path, "w") as f:
                f.write(json_str)
            data = json.loads(json_str)

        return data


def to_dict(dic):
    headers = dic["headers"]
    data = dic["data"]

    lst = []
    for value in data:
        lst += [{h: value[i] for i, h in enumerate(headers)}]
    return lst


class Team:
    def __init__(self, tricode, score):
        self.tricode = tricode
        self.score = score


class Game:
    def __init__(self, game_id, game_time_local, game_status, home_team, away_team):
        self.game_id = game_id
        self.game_time_local = game_time_local
        self.game_status = game_status
        self.home_team = home_team
        self.away_team = away_team


def get_games_of_day(client, date):
    score = client.get_scoreboard_v2(date)
    game_headers = to_dict(score["GameHeader"])
    return [header["GAME_ID"] for header in game_headers]


def generate_game(client, game_id, directory):
    pbp = client.get_playbyplay(game_id)
    # pbp = json.loads(playbyplay.PlayByPlay(game_id).get_json())
    bs = json.loads(boxscore.BoxScore(game_id).get_json())
    poc = make_players_on_court(pbp, bs)

    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, "playbyplay.json"), "w") as f:
        f.write(json.dumps(pbp))

    with open(os.path.join(directory, "boxscore.json"), "w") as f:
        f.write(json.dumps(bs))

    with open(os.path.join(directory, "poc.json"), "w") as f:
        f.write(json.dumps(poc))

    filename = os.path.join(directory, "index.html")
    make_play_by_play(filename, pbp, bs)


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


def parse_team(data):
    return Team(data["teamTricode"], data["score"])


def parse_boxscore(data):
    game = data["game"]
    game_time_local = dateutil.parser.parse(game["gameTimeLocal"])
    home_team = parse_team(game["homeTeam"])
    away_team = parse_team(game["awayTeam"])
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
    print(files)

    games = []
    for file in files:
        with open(file) as f:
            data = json.load(f)
            # print(json.dumps(data, indent=2))
            # print(data.keys())
            # print(data["game"].keys())
            # print(data["game"]["homeTeam"].keys())
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
    args = parser.parse_args()

    if args.update_index:
        games = scan_boxscores(os.path.join(args.output_directory, "games"))
        generate_index(games, args.output_directory)

    if args.download_games:
        if args.date is None:
            date = datetime.today()
        else:
            date = dateutil.parser.parse(args.date)

        client = NBAAPIClient("cache")
        game_ids = get_games_of_day(client, date.strftime("%Y-%m-%d"))
        for game_id in game_ids:
            path = os.path.join(args.output_directory, "games", game_id)
            if not os.path.exists(path):
                generate_game(client, game_id, path)
            else:
                print(f"{path} already exists")

    if args.generate_game:
        client = NBAAPIClient("cache")
        game_id = args.generate_game
        path = os.path.join(args.output_directory, "games", game_id)
        generate_game(client, game_id, path)


if __name__ == "__main__":
    main()

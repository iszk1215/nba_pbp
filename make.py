import json
import argparse

from jinja2 import Environment, FileSystemLoader
import dateutil.parser

env = Environment(loader=FileSystemLoader("."))


class Team:
    def __init__(self, js):
        self.tricode = js["teamTricode"]
        self.score = js["score"]


def get_elapsed(action):
    period = action["period"]
    clock = action["clock"]
    minutes = int(clock[2:4])
    seconds = float(clock[5:10])
    # print(f"{clock} {minutes} {seconds}")

    elapsed = 12 * 60 * 4 + 5 * 60 * (period - 4) - (minutes * 60 + seconds)
    if elapsed > 4 * 12 * 60 + 5 * 60:
        print(f"{clock} {minutes} {seconds} => {elapsed}")

    if period >=  5:
        return 12 * 60 * 4 + 5 * 60 * (period - 4) - (minutes * 60 + seconds)

    return 12 * 60 * period - (minutes * 60 + seconds)


def print_poc(poc, all_players):
    for personId in poc:
        total = 0
        for span in poc[personId]:
            total += span["end"] - span["begin"]

        player = all_players[personId]
        print(f"{player['teamTricode']} {player['nameI']} {total} {poc[personId]}")


def get_players(team):
    return {
        player["personId"]: player | {"teamTricode": team["teamTricode"]}
        for player in team["players"]
    }


def make_players_on_court(pbp, boxscore):
    awayTeam = boxscore["game"]["awayTeam"]
    homeTeam = boxscore["game"]["homeTeam"]

    all_players = get_players(awayTeam) | get_players(homeTeam)
    poc = {player["personId"]: [] for player in all_players.values()}

    # print_poc(poc, all_players)

    def pickup_starters(team):
        return [player for player in team["players"] if player["starter"] == "1"]

    for player in pickup_starters(awayTeam) + pickup_starters(homeTeam):
        poc[player["personId"]] += [{"begin": 0, "end": -1}]

    for action in pbp["game"]["actions"]:
        if action["actionType"] == "substitution":
            # print(f"{action['subType']:3} {action['playerName']} {get_elapsed(action)}")
            personId = action["personId"]
            elapsed = get_elapsed(action)
            assert elapsed <= 4 * 12 * 60 + 5 * 60
            if action["subType"] == "out":
                assert len(poc[personId]) > 0
                assert poc[personId][-1]["end"] == -1
                poc[personId][-1]["end"] = elapsed
            else:  # in
                poc[personId] += [{"begin": elapsed, "end": -1}]

    last_period = boxscore["game"]["period"]
    assert last_period >= 4
    elpased_last = 4 * 12 * 60 + (last_period - 4) * 5 * 60

    for personId in poc:
        oc = poc[personId]
        if len(oc) > 0 and oc[-1]["end"] == -1:
            poc[personId][-1]["end"] = elpased_last

    print_poc(poc, all_players)
    return poc


def make_play_by_play(args, pbp, boxscore):
    awayTeam = Team(boxscore["game"]["awayTeam"])
    homeTeam = Team(boxscore["game"]["homeTeam"])

    print(boxscore["game"]["gameTimeLocal"])

    dt = dateutil.parser.parse(boxscore["game"]["gameTimeLocal"])
    print(type(dt))
    print(dt.strftime("%a %b %d"))

    actions = pbp["game"]["actions"]

    if args.output is not None:
        with open(args.output, "w") as f:
            templ = env.get_template("template.html")
            f.write(
                templ.render(
                    gameId=pbp["game"]["gameId"],
                    awayTeam=awayTeam,
                    homeTeam=homeTeam,
                    gameTime=dt.strftime("%a %b %d"),
                    actions=actions,
                )
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output")
    parser.add_argument("-p", "--play-by-play")
    parser.add_argument("-b", "--boxscore")
    args = parser.parse_args()

    with open(args.play_by_play, "r") as f:
        play_by_play = json.load(f)

    with open(args.boxscore, "r") as f:
        boxscore = json.load(f)

    make_play_by_play(args, play_by_play, boxscore)

    gameId = play_by_play["game"]["gameId"]
    poc = make_players_on_court(play_by_play, boxscore)
    with open(f"data/{gameId}_poc.json", "w") as f:
        f.write(json.dumps(poc))


if __name__ == "__main__":
    main()

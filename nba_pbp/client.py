import json
import logging
import os
from pathlib import Path
from typing import Callable

from nba_api.live.nba.endpoints.playbyplay import PlayByPlay
from nba_api.live.nba.endpoints.boxscore import BoxScore
from nba_api.stats.endpoints import ScoreboardV2

_logger = logging.getLogger(__name__)


# parsers for ScoreboardV2


def parse_result_sets(result_sets):
    return {
        result_set["name"]: {
            "headers": result_set["headers"],
            "data": result_set["rowSet"],
        }
        for result_set in result_sets
    }


def parse_row_set(data):
    headers = data["headers"]
    data = data["data"]

    lst = []
    for value in data:
        lst += [{h: value[i] for i, h in enumerate(headers)}]
    return lst


class NBAAPIClient:
    def __init__(self, cache_dir):
        self.cache_dir = cache_dir

    def _ensure_cache_dir(self, path: Path):
        os.makedirs(path.parent, exist_ok=True)

    def _get(self, cache_path: Path, call_nba_api: Callable):
        self._ensure_cache_dir(cache_path)

        try:
            with open(cache_path) as f:
                data = json.load(f)
        except Exception:
            result = call_nba_api()
            with open(cache_path, "w") as f:
                _logger.info("write to %s", cache_path)
                f.write(result.get_json())
            data = json.loads(result.get_json())

        return data

    def get_boxscore(self, game_id: str):
        cache_path = Path(self.cache_dir) / "BoxScore" / f"{game_id}.json"
        return self._get(cache_path, lambda: BoxScore(game_id))

    def get_scoreboard_v2(self, date: str):
        cache_path = Path(self.cache_dir) / "ScoreboardV2" / f"{date}.json"
        return self._get(cache_path, lambda: ScoreboardV2(game_date=date))

    def get_playbyplay(self, game_id: str):
        cache_path = Path(self.cache_dir) / "PlayByPlay" / f"{game_id}.json"
        return self._get(cache_path, lambda: PlayByPlay(game_id))

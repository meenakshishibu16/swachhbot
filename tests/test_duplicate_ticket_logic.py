from agents import memory


class FakeCursor:
    def __init__(self, row):
        self.row = row

    def execute(self, query, params):
        self.query = query
        self.params = params

    def fetchone(self):
        return self.row

    def close(self):
        return None


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.cursor_obj = FakeCursor(row)

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        return None

    def close(self):
        return None


def test_find_existing_ticket_for_same_issue_within_20m(monkeypatch):
    monkeypatch.setattr(
        memory,
        "get_connection",
        lambda: FakeConnection(("BBMP-1234",)),
    )

    ticket_context = memory.get_existing_ticket_context(12.97, 77.59, "pothole")

    assert ticket_context["ticket_id"] == "BBMP-1234"
    assert ticket_context["status"] == "filed"
    assert ticket_context["ward"] == "Ward 1"

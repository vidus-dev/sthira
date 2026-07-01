from app.api.problem import problem_body


def test_problem_body_includes_request_id_when_set() -> None:
    body = problem_body(
        status=400,
        title="Bad request",
        detail="oops",
        request_id="rid-1",
    )
    assert body["status"] == 400
    assert body["detail"] == "oops"
    assert body["request_id"] == "rid-1"

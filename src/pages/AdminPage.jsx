import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function AdminPage({ user }) {
  const [sessions, setSessions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [newSurveyTitle, setNewSurveyTitle] = useState("");
  const [newSurveyDescription, setNewSurveyDescription] = useState("");
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [surveyMessage, setSurveyMessage] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      setError("");

      const [
        { data: sessionData, error: sessionError },
        { data: answerData, error: answerError },
        { data: questionData, error: questionError },
        { data: optionData, error: optionError },
        { data: surveyData, error: surveyError },
      ] = await Promise.all([
        supabase
          .from("response_sessions")
          .select(
            `
            id,
            user_id,
            survey_id,
            started_at,
            completed_at,
            duration_seconds,
            surveys (
              title
            )
          `,
          )
          .order("started_at", { ascending: false }),

        supabase
          .from("answers")
          .select(
            `
            id,
            session_id,
            question_id,
            answer_text,
            selected_option_id,
            created_at
          `,
          )
          .order("created_at", { ascending: true }),

        supabase
          .from("questions")
          .select(
            `
            id,
            survey_id,
            question_text,
            question_type,
            order_num
          `,
          )
          .order("order_num", { ascending: true }),

        supabase
          .from("options")
          .select(
            `
            id,
            question_id,
            option_text,
            order_num
          `,
          )
          .order("order_num", { ascending: true }),

        supabase
          .from("surveys")
          .select(
            `
            id,
            title,
            description,
            is_active,
            created_at
          `,
          )
          .order("created_at", { ascending: false }),
      ]);

      if (sessionError) {
        setError("응답 세션 조회 실패: " + sessionError.message);
        setLoading(false);
        return;
      }

      if (answerError) {
        setError("답변 조회 실패: " + answerError.message);
        setLoading(false);
        return;
      }

      if (questionError) {
        setError("질문 조회 실패: " + questionError.message);
        setLoading(false);
        return;
      }

      if (optionError) {
        setError("선택지 조회 실패: " + optionError.message);
        setLoading(false);
        return;
      }

      if (surveyError) {
        setError("설문 목록 조회 실패: " + surveyError.message);
        setLoading(false);
        return;
      }

      setSessions(sessionData || []);
      setAnswers(answerData || []);
      setQuestions(questionData || []);
      setOptions(optionData || []);
      setSurveys(surveyData || []);
      setLoading(false);
    }

    loadAdminData();
  }, []);

  const questionMap = useMemo(() => {
    const map = {};
    for (const question of questions) {
      map[question.id] = question;
    }
    return map;
  }, [questions]);

  const optionsByQuestion = useMemo(() => {
    const grouped = {};

    for (const option of options) {
      if (!grouped[option.question_id]) {
        grouped[option.question_id] = [];
      }
      grouped[option.question_id].push(option);
    }

    return grouped;
  }, [options]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const baseDate = session.completed_at || session.started_at;
      const sessionDate = baseDate ? new Date(baseDate) : null;

      if (startDate && sessionDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (sessionDate < start) return false;
      }

      if (endDate && sessionDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (sessionDate > end) return false;
      }

      if (userSearch.trim()) {
        const keyword = userSearch.trim().toLowerCase();
        const userId = (session.user_id || "").toLowerCase();
        if (!userId.includes(keyword)) return false;
      }

      return true;
    });
  }, [sessions, startDate, endDate, userSearch]);

  const filteredSessionIds = useMemo(() => {
    return new Set(filteredSessions.map((session) => session.id));
  }, [filteredSessions]);

  const filteredAnswers = useMemo(() => {
    return answers.filter((answer) =>
      filteredSessionIds.has(answer.session_id),
    );
  }, [answers, filteredSessionIds]);

  const filteredAnswersBySession = useMemo(() => {
    const grouped = {};

    for (const answer of filteredAnswers) {
      if (!grouped[answer.session_id]) {
        grouped[answer.session_id] = [];
      }
      grouped[answer.session_id].push(answer);
    }

    for (const sessionId in grouped) {
      grouped[sessionId].sort((a, b) => {
        const aOrder = questionMap[a.question_id]?.order_num ?? 9999;
        const bOrder = questionMap[b.question_id]?.order_num ?? 9999;
        return aOrder - bOrder;
      });
    }

    return grouped;
  }, [filteredAnswers, questionMap]);

  const totalSessions = filteredSessions.length;

  const averageDuration = useMemo(() => {
    if (filteredSessions.length === 0) return 0;
    const total = filteredSessions.reduce((sum, session) => {
      return sum + (session.duration_seconds || 0);
    }, 0);
    return Math.round(total / filteredSessions.length);
  }, [filteredSessions]);

  const latestSubmittedAt = useMemo(() => {
    if (filteredSessions.length === 0) return null;

    const sorted = [...filteredSessions].sort((a, b) => {
      const aTime = new Date(a.completed_at || a.started_at || 0).getTime();
      const bTime = new Date(b.completed_at || b.started_at || 0).getTime();
      return bTime - aTime;
    });

    return sorted[0]?.completed_at || sorted[0]?.started_at || null;
  }, [filteredSessions]);

  const questionStats = useMemo(() => {
    const base = questions.map((question) => {
      const questionOptions = optionsByQuestion[question.id] || [];

      const initialCounts = {};
      for (const option of questionOptions) {
        initialCounts[option.option_text] = 0;
      }

      return {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        orderNum: question.order_num,
        respondentSet: new Set(),
        totalAnswerRows: 0,
        counts: initialCounts,
        textResponses: [],
      };
    });

    const statMap = {};
    for (const item of base) {
      statMap[item.questionId] = item;
    }

    for (const answer of filteredAnswers) {
      const stat = statMap[answer.question_id];
      if (!stat) continue;

      stat.totalAnswerRows += 1;
      stat.respondentSet.add(answer.session_id);

      const value = answer.answer_text?.trim() || "(빈 답변)";

      if (stat.questionType === "text") {
        if (value !== "(빈 답변)") {
          stat.textResponses.push(value);
        }
      } else {
        if (stat.counts[value] === undefined) {
          stat.counts[value] = 0;
        }
        stat.counts[value] += 1;
      }
    }

    return base
      .map((item) => {
        const respondentCount = item.respondentSet.size;

        const distribution = Object.entries(item.counts)
          .map(([label, count]) => ({
            label,
            count,
            percent:
              respondentCount === 0
                ? 0
                : Math.round((count / respondentCount) * 100),
          }))
          .sort((a, b) => b.count - a.count);

        const textSamples = [...new Set(item.textResponses)].slice(0, 5);

        return {
          questionId: item.questionId,
          questionText: item.questionText,
          questionType: item.questionType,
          orderNum: item.orderNum,
          respondentCount,
          totalAnswerRows: item.totalAnswerRows,
          distribution,
          textSamples,
        };
      })
      .sort((a, b) => a.orderNum - b.orderNum);
  }, [questions, filteredAnswers, optionsByQuestion]);

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setUserSearch("");
  };

  const downloadCsv = () => {
    const rows = [];

    rows.push([
      "session_id",
      "survey_title",
      "user_id",
      "started_at",
      "completed_at",
      "duration_seconds",
      "question_order",
      "question_text",
      "question_type",
      "answer_text",
    ]);

    for (const session of filteredSessions) {
      const sessionAnswers = filteredAnswersBySession[session.id] || [];

      if (sessionAnswers.length === 0) {
        rows.push([
          session.id,
          session.surveys?.title || "",
          session.user_id || "",
          session.started_at || "",
          session.completed_at || "",
          session.duration_seconds || 0,
          "",
          "",
          "",
          "",
        ]);
        continue;
      }

      for (const answer of sessionAnswers) {
        const question = questionMap[answer.question_id];

        rows.push([
          session.id,
          session.surveys?.title || "",
          session.user_id || "",
          session.started_at || "",
          session.completed_at || "",
          session.duration_seconds || 0,
          question?.order_num ?? "",
          question?.question_text || "",
          question?.question_type || "",
          answer.answer_text || "",
        ]);
      }
    }

    const escapeCsv = (value) => {
      const stringValue = String(value ?? "");
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const csvContent = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `survey-responses-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    setSurveyMessage("");
    setError("");

    const title = newSurveyTitle.trim();
    const description = newSurveyDescription.trim();

    if (!title) {
      setSurveyMessage("설문 제목은 필수입니다.");
      return;
    }

    setCreatingSurvey(true);

    const { data, error: insertError } = await supabase
      .from("surveys")
      .insert({
        title,
        description,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      setSurveyMessage("설문 생성 실패: " + insertError.message);
      setCreatingSurvey(false);
      return;
    }

    setSurveys((prev) => [data, ...prev]);
    setNewSurveyTitle("");
    setNewSurveyDescription("");
    setSurveyMessage("새 설문이 생성되었습니다.");
    setCreatingSurvey(false);
  };

  if (loading) {
    return <div className="page">관리자 데이터를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <div className="notice notice-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard-shell">
        <div className="dashboard-hero">
          <h1>관리자 대시보드</h1>
          <p>
            설문 생성, 응답 통계, 필터, CSV 다운로드를 한 화면에서 관리합니다.
          </p>
        </div>

        <div className="admin-top-grid">
          <section className="panel">
            <h2 className="panel-title">새 설문 만들기</h2>

            <form onSubmit={handleCreateSurvey} className="form-stack">
              <div className="form-group">
                <label className="form-label">설문 제목</label>
                <input
                  className="input"
                  type="text"
                  placeholder="예: 고객 만족도 조사"
                  value={newSurveyTitle}
                  onChange={(e) => setNewSurveyTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">설문 설명</label>
                <textarea
                  className="textarea"
                  rows="3"
                  placeholder="설문에 대한 간단한 설명을 입력하세요"
                  value={newSurveyDescription}
                  onChange={(e) => setNewSurveyDescription(e.target.value)}
                />
              </div>

              <div className="button-row">
                <button
                  type="submit"
                  disabled={creatingSurvey}
                  className="btn btn-primary"
                >
                  {creatingSurvey ? "생성 중..." : "설문 생성"}
                </button>
              </div>

              {surveyMessage && (
                <div
                  className={
                    surveyMessage.includes("실패") ||
                    surveyMessage.includes("필수")
                      ? "notice notice-error"
                      : "notice notice-success"
                  }
                >
                  {surveyMessage}
                </div>
              )}
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">설문 목록</h2>

            {surveys.length === 0 ? (
              <div className="empty-state">등록된 설문이 없습니다.</div>
            ) : (
              <div className="survey-list">
                {surveys.map((survey) => (
                  <div key={survey.id} className="survey-item">
                    <div className="survey-item-title">{survey.title}</div>
                    <div className="survey-item-desc">
                      {survey.description || "설명 없음"}
                    </div>

                    <div className="meta-box">
                      <span
                        className={
                          survey.is_active ? "badge-active" : "badge-inactive"
                        }
                      >
                        {survey.is_active ? "활성" : "비활성"}
                      </span>
                      <span className="meta-pill">
                        생성일{" "}
                        {survey.created_at
                          ? new Date(survey.created_at).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="panel">
          <h2 className="panel-title">응답 필터</h2>

          <div className="filter-grid">
            <div className="form-group">
              <label className="form-label">시작일</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">종료일</label>
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">사용자 ID 검색</label>
              <input
                className="input"
                type="text"
                placeholder="user_id 일부 입력"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="button-row" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetFilters}
            >
              필터 초기화
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={downloadCsv}
              disabled={filteredSessions.length === 0}
            >
              CSV 다운로드
            </button>
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">현재 관리자</div>
            <div className="stat-value stat-value-sm">{user?.email}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">필터된 응답 세션</div>
            <div className="stat-value">{totalSessions}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">평균 소요 시간</div>
            <div className="stat-value">{averageDuration}초</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">최근 제출</div>
            <div className="stat-value stat-value-sm">
              {latestSubmittedAt
                ? new Date(latestSubmittedAt).toLocaleString()
                : "데이터 없음"}
            </div>
          </div>
        </div>

        <section className="admin-section">
          <h2 className="panel-title">질문별 응답 집계</h2>

          {questionStats.length === 0 ? (
            <div className="empty-state">질문 데이터가 없습니다.</div>
          ) : (
            <div className="list-stack">
              {questionStats.map((stat) => (
                <div key={stat.questionId} className="panel">
                  <div className="panel-title panel-head-tight">
                    {stat.orderNum}. {stat.questionText}
                  </div>

                  <p className="panel-subtitle">
                    유형: {stat.questionType} / 응답자 수:{" "}
                    {stat.respondentCount}
                    {stat.questionType === "checkbox"
                      ? ` / 총 선택 수: ${stat.totalAnswerRows}`
                      : ""}
                  </p>

                  {stat.questionType === "text" ? (
                    stat.textSamples.length === 0 ? (
                      <div className="empty-state">
                        아직 저장된 응답이 없습니다.
                      </div>
                    ) : (
                      <ul className="muted-list">
                        {stat.textSamples.map((text, index) => (
                          <li key={index}>{text}</li>
                        ))}
                      </ul>
                    )
                  ) : stat.distribution.length === 0 ? (
                    <div className="empty-state">집계할 응답이 없습니다.</div>
                  ) : (
                    <div className="metric-list">
                      {stat.distribution.map((item) => (
                        <div key={item.label} className="metric-row">
                          <div className="metric-head">
                            <span>{item.label}</span>
                            <span>
                              {item.count}명 ({item.percent}%)
                            </span>
                          </div>
                          <div className="metric-bar">
                            <div
                              className="metric-bar-fill"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2 className="panel-title">제출된 응답 상세</h2>

          {filteredSessions.length === 0 ? (
            <div className="empty-state">
              현재 필터 조건에 맞는 응답이 없습니다.
            </div>
          ) : (
            <div className="detail-list">
              {filteredSessions.map((session, index) => {
                const sessionAnswers =
                  filteredAnswersBySession[session.id] || [];

                return (
                  <div key={session.id} className="panel">
                    <h3 className="panel-title panel-head-tight">
                      응답 #{totalSessions - index}
                    </h3>

                    <div className="meta-box">
                      <span className="meta-pill">
                        설문명 {session.surveys?.title || "알 수 없는 설문"}
                      </span>
                      <span className="meta-pill">
                        사용자 {session.user_id}
                      </span>
                      <span className="meta-pill">
                        소요 시간 {session.duration_seconds || 0}초
                      </span>
                    </div>

                    <div className="timestamp-block">
                      시작 시간:{" "}
                      {session.started_at
                        ? new Date(session.started_at).toLocaleString()
                        : "-"}
                      <br />
                      완료 시간:{" "}
                      {session.completed_at
                        ? new Date(session.completed_at).toLocaleString()
                        : "-"}
                    </div>

                    <div style={{ marginTop: "18px" }}>
                      {sessionAnswers.length === 0 ? (
                        <div className="empty-state">
                          저장된 답변이 없습니다.
                        </div>
                      ) : (
                        <div className="answers-list">
                          {sessionAnswers.map((answer) => (
                            <div key={answer.id} className="answer-item">
                              <div className="answer-item-title">
                                {questionMap[answer.question_id]?.order_num ??
                                  "?"}
                                .{" "}
                                {questionMap[answer.question_id]
                                  ?.question_text || "질문을 찾을 수 없음"}
                              </div>
                              <div>
                                답변:{" "}
                                <strong>{answer.answer_text || "-"}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminPage;

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function SurveyPage({ user }) {
  const [survey, setSurvey] = useState(null)
  const [questions, setQuestions] = useState([])
  const [optionsByQuestion, setOptionsByQuestion] = useState({})
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const startTimeRef = useRef(new Date())

  useEffect(() => {
    async function loadSurvey() {
      setLoading(true)
      setError('')
      setSubmitMessage('')
      startTimeRef.current = new Date()

      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (surveyError) {
        setError('설문 불러오기 실패: ' + surveyError.message)
        setLoading(false)
        return
      }

      if (!surveyData || surveyData.length === 0) {
        setError('활성화된 설문이 없습니다.')
        setLoading(false)
        return
      }

      const currentSurvey = surveyData[0]
      setSurvey(currentSurvey)

      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', currentSurvey.id)
        .order('order_num', { ascending: true })

      if (questionError) {
        setError('질문 불러오기 실패: ' + questionError.message)
        setLoading(false)
        return
      }

      const loadedQuestions = questionData || []
      setQuestions(loadedQuestions)

      const questionIds = loadedQuestions.map((q) => q.id)

      if (questionIds.length > 0) {
        const { data: optionData, error: optionError } = await supabase
          .from('options')
          .select('*')
          .in('question_id', questionIds)
          .order('order_num', { ascending: true })

        if (optionError) {
          setError('선택지 불러오기 실패: ' + optionError.message)
          setLoading(false)
          return
        }

        const grouped = {}
        for (const option of optionData || []) {
          if (!grouped[option.question_id]) {
            grouped[option.question_id] = []
          }
          grouped[option.question_id].push(option)
        }

        setOptionsByQuestion(grouped)
      }

      setLoading(false)
    }

    loadSurvey()
  }, [])

  const visibleQuestions = useMemo(() => {
    return questions.filter((question) => {
      if (!question.condition_question_id || !question.condition_answer) {
        return true
      }

      const parentAnswer = answers[question.condition_question_id]

      if (Array.isArray(parentAnswer)) {
        return parentAnswer.includes(question.condition_answer)
      }

      return parentAnswer === question.condition_answer
    })
  }, [questions, answers])

  const handleRadioChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleTextChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleCheckboxChange = (questionId, value, checked) => {
    setAnswers((prev) => {
      const current = prev[questionId] || []

      if (checked) {
        return {
          ...prev,
          [questionId]: [...current, value],
        }
      }

      return {
        ...prev,
        [questionId]: current.filter((item) => item !== value),
      }
    })
  }

  const handleScaleChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const buildAnswerRows = (sessionId) => {
    const rows = []

    for (const question of visibleQuestions) {
      const value = answers[question.id]

      if (value === undefined || value === null || value === '') continue

      const questionOptions = optionsByQuestion[question.id] || []

      if (question.question_type === 'radio') {
        const matchedOption = questionOptions.find(
          (option) => option.option_text === value
        )

        rows.push({
          session_id: sessionId,
          question_id: question.id,
          answer_text: value,
          selected_option_id: matchedOption?.id ?? null,
        })
      }

      if (question.question_type === 'checkbox') {
        const values = Array.isArray(value) ? value : []

        for (const selectedText of values) {
          const matchedOption = questionOptions.find(
            (option) => option.option_text === selectedText
          )

          rows.push({
            session_id: sessionId,
            question_id: question.id,
            answer_text: selectedText,
            selected_option_id: matchedOption?.id ?? null,
          })
        }
      }

      if (question.question_type === 'text') {
        rows.push({
          session_id: sessionId,
          question_id: question.id,
          answer_text: value,
          selected_option_id: null,
        })
      }

      if (question.question_type === 'scale') {
        rows.push({
          session_id: sessionId,
          question_id: question.id,
          answer_text: String(value),
          selected_option_id: null,
        })
      }
    }

    return rows
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitMessage('')

    if (!user) {
      setError('제출하려면 먼저 로그인해 주세요.')
      return
    }

    if (!survey) {
      setError('설문 정보가 없습니다.')
      return
    }

    setSubmitting(true)

    const startedAt = startTimeRef.current
    const completedAt = new Date()
    const durationSeconds = Math.max(
      1,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
    )

    const { data: sessionData, error: sessionError } = await supabase
      .from('response_sessions')
      .insert({
        user_id: user.id,
        survey_id: survey.id,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .select()
      .single()

    if (sessionError) {
      setError('응답 세션 저장 실패: ' + sessionError.message)
      setSubmitting(false)
      return
    }

    const answerRows = buildAnswerRows(sessionData.id)

    if (answerRows.length > 0) {
      const { error: answerError } = await supabase
        .from('answers')
        .insert(answerRows)

      if (answerError) {
        setError('답변 저장 실패: ' + answerError.message)
        setSubmitting(false)
        return
      }
    }

    setSubmitMessage(`제출이 완료되었습니다. 총 소요 시간: ${durationSeconds}초`)
    setAnswers({})
    startTimeRef.current = new Date()
    setSubmitting(false)
  }

  if (loading) {
    return <div className="page">설문 불러오는 중...</div>
  }

  if (error && !survey) {
    return (
      <div className="page page-narrow">
        <div className="notice notice-error">{error}</div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="page page-narrow">
        <div className="empty-state">표시할 설문이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <h1>{survey.title}</h1>
        <p>{survey.description || '설문에 참여해 주셔서 감사합니다.'}</p>

        <div className="meta-box">
          <span className="meta-pill">
            질문 수 {visibleQuestions.length}개
          </span>
          <span className="meta-pill">
            {user ? '로그인 상태' : '비로그인 상태'}
          </span>
        </div>
      </div>

      <div className="stack-lg">
        {!user && (
          <div className="notice notice-warning">
            설문 제출을 하려면 먼저 <Link to="/login"><strong>로그인</strong></Link> 해주세요.
          </div>
        )}

        {error && survey && (
          <div className="notice notice-error">{error}</div>
        )}

        {submitMessage && (
          <div className="notice notice-success">{submitMessage}</div>
        )}

        <div className="stack-md">
          {visibleQuestions.map((question) => {
            const questionOptions = optionsByQuestion[question.id] || []

            return (
              <div key={question.id} className="question-card">
                <h3 className="question-title">
                  {question.order_num}. {question.question_text}
                </h3>

                {question.question_type === 'radio' && (
                  <div className="option-list">
                    {questionOptions.map((option) => (
                      <label key={option.id} className="option-item">
                        <input
                          type="radio"
                          name={question.id}
                          value={option.option_text}
                          checked={answers[question.id] === option.option_text}
                          onChange={(e) => handleRadioChange(question.id, e.target.value)}
                        />
                        <span>{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.question_type === 'checkbox' && (
                  <div className="option-list">
                    {questionOptions.map((option) => (
                      <label key={option.id} className="option-item">
                        <input
                          type="checkbox"
                          value={option.option_text}
                          checked={(answers[question.id] || []).includes(option.option_text)}
                          onChange={(e) =>
                            handleCheckboxChange(
                              question.id,
                              option.option_text,
                              e.target.checked
                            )
                          }
                        />
                        <span>{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.question_type === 'text' && (
                  <textarea
                    className="textarea"
                    rows="4"
                    placeholder="답변을 입력하세요"
                    value={answers[question.id] || ''}
                    onChange={(e) => handleTextChange(question.id, e.target.value)}
                  />
                )}

                {question.question_type === 'scale' && (
                  <div className="scale-row">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleScaleChange(question.id, score)}
                        className={
                          answers[question.id] === score
                            ? 'scale-btn active'
                            : 'scale-btn'
                        }
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="button-row">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? '제출 중...' : '설문 제출'}
          </button>
        </div>

        <div className="panel">
          <h3 className="panel-title">현재 입력값 미리보기</h3>
          <pre>{JSON.stringify(answers, null, 2)}</pre>
        </div>

        <div className="panel">
          <h3 className="panel-title">제출 전 확인</h3>
          <p className="muted" style={{ margin: 0 }}>
            모든 필수 응답을 확인한 뒤 제출해주세요. 제출 후 관리자 페이지에서 응답 통계를 확인할 수 있습니다.
          </p>
        </div>
        
      </div>
    </div>
  )
}

export default SurveyPage

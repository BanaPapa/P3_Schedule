-- 3차: 학교 일정(학사일정·행사·과제·시험·준비물)과 학습 관리(과목·진도·학습 기록)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
insert into public.children (family_id, name) select id, '박첫째' from public.families;
reset role;
select set_config('test.child_b', (select id::text from public.children where name = '박첫째'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
reset role;
select set_config('test.family', (select id::text from public.families where name = '김씨네'), true);
select set_config('test.child', (select id::text from public.children where name = '첫째'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 학교 일정
select lives_ok(
  format($$insert into public.school_events (family_id, child_id, kind, event_date, title, subject)
    values (%L, %L, 'exam', '2027-04-20', '1학기 중간고사', '수학')$$,
    current_setting('test.family'), current_setting('test.child')),
  'parent can add an exam'
);
select lives_ok(
  format($$insert into public.school_events (family_id, child_id, kind, event_date, end_date, title)
    values (%L, %L, 'holiday', '2027-07-25', '2027-08-20', '여름방학')$$,
    current_setting('test.family'), current_setting('test.child')),
  'a school event can span days'
);
select throws_ok(
  format($$insert into public.school_events (family_id, child_id, kind, event_date, title)
    values (%L, %L, 'event', '2027-05-01', '다른 집 아이')$$,
    current_setting('test.family'), current_setting('test.child_b')),
  '23503', null, 'an event cannot point at a child of another family'
);
select throws_ok(
  format($$insert into public.school_events (family_id, child_id, kind, event_date, end_date, title)
    values (%L, %L, 'event', '2027-05-02', '2027-05-01', '거꾸로')$$,
    current_setting('test.family'), current_setting('test.child')),
  '23514', null, 'end date cannot be before the date'
);
reset role;
select set_config('test.exam', (select id::text from public.school_events where kind = 'exam'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 시험 점수와 준비물
select lives_ok(
  format($$update public.school_events set score = 92, max_score = 100 where id = %L$$, current_setting('test.exam')),
  'an exam score can be recorded'
);
select throws_ok(
  format($$update public.school_events set score = 120, max_score = 100 where id = %L$$, current_setting('test.exam')),
  '23514', null, 'a score cannot exceed the maximum'
);
select lives_ok(
  format($$insert into public.school_event_items (family_id, event_id, label)
    values (%1$L, %2$L, '컴퓨터용 사인펜'), (%1$L, %2$L, '수정테이프')$$,
    current_setting('test.family'), current_setting('test.exam')),
  'supplies can be listed for an event'
);
select lives_ok(
  $$update public.school_event_items set checked = true where label = '수정테이프'$$,
  'a supply can be checked off'
);
select results_eq(
  $$select item_count::int, unchecked_count::int from public.school_event_summaries where kind = 'exam'$$,
  $$values (2, 1)$$,
  'the event summary counts unprepared supplies'
);

-- 학습: 과목과 기록
select lives_ok(
  format($$insert into public.study_subjects (family_id, child_id, name, textbook, goal)
    values (%L, %L, '수학', '디딤돌 기본', '1학기 분수 완성')$$,
    current_setting('test.family'), current_setting('test.child')),
  'parent can add a study subject'
);
select throws_ok(
  format($$insert into public.study_subjects (family_id, child_id, name) values (%L, %L, '수학')$$,
    current_setting('test.family'), current_setting('test.child')),
  '23505', null, 'a child has one subject per name'
);
select lives_ok(
  format($$insert into public.study_logs (family_id, subject_id, studied_on, minutes, unit, progress_percent, content)
    select %L, id, '2027-04-01', 40, '3단원 분수', 30, '분수의 덧셈 연습' from public.study_subjects$$,
    current_setting('test.family')),
  'a study log with progress can be recorded'
);
select throws_ok(
  format($$insert into public.study_logs (family_id, subject_id, studied_on, progress_percent)
    select %L, id, '2027-04-02', 101 from public.study_subjects$$, current_setting('test.family')),
  '23514', null, 'progress is 0..100'
);
select results_eq(
  $$select latest_unit, latest_percent::int, total_minutes::int from public.study_subject_summaries$$,
  $$values ('3단원 분수'::text, 30, 40)$$,
  'the subject summary shows the latest progress and total time'
);
select ok(
  (select count(*) from public.audit_logs where table_name in ('school_events', 'school_event_items', 'study_subjects', 'study_logs')) >= 7,
  'school and study changes are logged'
);
reset role;

-- 다른 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.school_events) + (select count(*)::int from public.study_logs),
  0, 'other family sees no school events or study logs'
);
select throws_ok(
  format($$insert into public.school_event_items (family_id, event_id, label) values (%L, %L, '침입')$$,
    current_setting('test.family'), current_setting('test.exam')),
  '42501', null, 'other family cannot add supplies to our event'
);
reset role;

select * from finish();
rollback;

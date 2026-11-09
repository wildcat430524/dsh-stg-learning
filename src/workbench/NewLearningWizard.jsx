import { experienceCSS } from './experience-style.js';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Navigation.jsx';
import { operationId } from './model.js';
import { newLearningCSS } from './new-learning-style.js';

import { validateLearningName } from '../learning-name.js';

/**
 * A full, quiet page for naming a new learning space. It creates only the
 * folder through the host. Goals, baseline, sessions and drafts belong to the
 * guided conversation that starts after onReady.
 */
export function NewLearningWizard({ api, onCancel, onReady }) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [createdPath, setCreatedPath] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null), pendingRef = useRef(false), mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const frame = requestAnimationFrame(() => { if (mounted.current) inputRef.current?.focus(); });
    return () => { mounted.current = false; cancelAnimationFrame(frame); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    const problem = validateLearningName(name);
    if (problem) {
      setFieldError(problem);
      setServerError('');
      setCreatedPath('');
      setNotice('');
      inputRef.current?.focus();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setFieldError('');
    setServerError('');
    setCreatedPath('');
    setNotice('');

    let result;
    try {
      // Only the two server-supported fields. The host owns folder selection
      // and returns the absolute created path; we never send one ourselves.
      result = await api.createLearning({ name, operationId: operationId() });
    } catch (error) {
      if (mounted.current) {
        setServerError(error?.message || '学习空间未能创建，请稍后再试。');
        if (error?.details?.createdPath) setCreatedPath(String(error.details.createdPath));
      }
      return;
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }

    if (!mounted.current) return;
    if (result?.cancelled) {
      setNotice('已取消选择，填写内容仍然保留。');
      return;
    }
    onReady(result.workspace);
  }

  function changeName(event) {
    setName(event.target.value);
    if (fieldError) setFieldError('');
    if (!createdPath) setServerError('');
    setNotice('');
  }

  return <section className="stgw-onboarding" aria-labelledby="stgw-onboarding-title" aria-busy={pending}>
    <style>{newLearningCSS}{experienceCSS}</style>
    <div className="stgw-onboarding-shell">
      <header className="stgw-onboarding-top">
        <div className="stgw-onboarding-brand">
          <span className="stgw-onboarding-brand-mark"><Icon name="book" size={18}/></span>
          <span><strong>StepsToGreat</strong><small>学习空间</small></span>
        </div>
        <button className="stgw-onboarding-back" type="button" disabled={pending} onClick={onCancel}>
          <Icon name="back" size={15}/>返回学习空间
        </button>
      </header>

      <div className="stgw-onboarding-layout">
        <main className="stgw-onboarding-main">
          <p className="stgw-onboarding-eyebrow">新的学习空间</p>
          <h1 id="stgw-onboarding-title">想开始哪一段学习？</h1>
          <p className="stgw-onboarding-intro">起个名字，选择保存位置，就可以和老师聊聊。</p>

          <form className="stgw-onboarding-card" onSubmit={submit} noValidate>
            <div className="stgw-onboarding-field" data-invalid={!!fieldError}>
              <div className="stgw-onboarding-label-row">
                <label htmlFor="stgw-learning-name">学习空间名称</label>
                <span className="stgw-onboarding-required">必填</span>
              </div>
              <input
                id="stgw-learning-name"
                ref={inputRef}
                type="text"
                value={name}
                maxLength={80}
                required
                aria-required="true"
                aria-invalid={!!fieldError}
                aria-describedby={`stgw-learning-name-help${fieldError ? ' stgw-learning-name-error' : ''}`}
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                placeholder="例如：把 Python 用到工作里"
                onChange={changeName}
              />
              <p className="stgw-onboarding-help" id="stgw-learning-name-help">这也是学习文件夹的名称，最多 80 个字符。</p>
              {fieldError && <p className="stgw-onboarding-field-error" id="stgw-learning-name-error" role="alert">{fieldError}</p>}
            </div>

            <div className="stgw-onboarding-actions">
              <button className="stgw-onboarding-primary" type="submit" disabled={pending} data-pending={pending || undefined}>
                {pending ? <span className="stgw-onboarding-spinner" aria-hidden="true"/> : <Icon name="arrow" size={15}/>}
                {pending ? '等待系统选择位置…' : '选择位置并创建学习空间'}
              </button>
              <button className="stgw-onboarding-secondary" type="button" disabled={pending} onClick={onCancel}>取消</button>
            </div>

            {(pending || notice) && <p className="stgw-onboarding-status" role="status">
              {pending ? '正在等待系统选择存放位置；选定后会初始化学习空间，请不要关闭此页面。' : notice}
            </p>}

            {serverError && <div className="stgw-onboarding-alert" role="alert">
              <p className="stgw-onboarding-alert-message">{serverError}</p>
              {createdPath && <p className="stgw-onboarding-created-path">已保留的目录：<code>{createdPath}</code></p>}
              <p className="stgw-onboarding-alert-hint">{createdPath ? '文件已保留，请通过导入学习空间继续。' : '修改后可重新选择存放位置，不会覆盖已有文件。'}</p>
            </div>}
          </form>
        </main>


      </div>

      <footer className="stgw-onboarding-footer">
        <span>已有同名目录不会被覆盖。</span>
        <span>学习文件保存在本地文件夹，不依赖聊天记录。</span>
      </footer>
    </div>
  </section>;
}

/**
 * Bib Detail Page（/orgs/:orgId/bibs/:bibId）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/bibs/:bibId
 * - PATCH /api/v1/orgs/:orgId/bibs/:bibId
 * - POST  /api/v1/orgs/:orgId/bibs/:bibId/items
 * - GET   /api/v1/orgs/:orgId/items?bibliographic_id=:bibId
 *
 * 這頁後續會提供：
 * - 檢視/更新書目（例如改書名、補 ISBN）
 * - 列出該書目的冊（items）
 * - 在書目底下新增冊（以條碼/索書號/位置）
 */

// 需要抓資料 + 編輯表單 + 新增冊，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { BibliographicRecordWithCounts, ItemCopy, ItemStatus, Location } from '../../../../lib/api';
import {
  createItem,
  getBib,
  listItems,
  listLocations,
  updateBib,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

// textarea（每行一個）→ string[]，空白行忽略；回 undefined 代表「沒有值」。
function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export default function BibDetailPage({ params }: { params: { orgId: string; bibId: string } }) {
  // 主要資料：書目 + 該書目的冊 + location 清單（用於新增冊的下拉選單）。
  const [bib, setBib] = useState<BibliographicRecordWithCounts | null>(null);
  const [items, setItems] = useState<ItemCopy[] | null>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);

  // UI 狀態：loading/error/success。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ------ 書目更新表單（以「勾選欄位」的方式建立 PATCH payload）------
  const [updateTitle, setUpdateTitle] = useState(false);
  const [title, setTitle] = useState('');

  const [updateCreators, setUpdateCreators] = useState(false);
  const [creators, setCreators] = useState('');

  const [updateSubjects, setUpdateSubjects] = useState(false);
  const [subjects, setSubjects] = useState('');

  const [updatePublisher, setUpdatePublisher] = useState(false);
  const [publisher, setPublisher] = useState('');

  const [updatePublishedYear, setUpdatePublishedYear] = useState(false);
  const [publishedYear, setPublishedYear] = useState('');

  const [updateLanguage, setUpdateLanguage] = useState(false);
  const [language, setLanguage] = useState('');

  const [updateIsbn, setUpdateIsbn] = useState(false);
  const [isbn, setIsbn] = useState('');

  const [updateClassification, setUpdateClassification] = useState(false);
  const [classification, setClassification] = useState('');

  const [updating, setUpdating] = useState(false);

  // ------ 新增冊（items）表單 ------
  const [barcode, setBarcode] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<ItemStatus>('available');
  const [notes, setNotes] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);

  // 讓 <select> 在 locations 尚未載入時不會選到不存在的值。
  const locationOptions = useMemo(() => locations ?? [], [locations]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 以 Promise.all 平行抓資料，加快頁面反應。
      const [bibResult, itemsResult, locationsResult] = await Promise.all([
        getBib(params.orgId, params.bibId),
        listItems(params.orgId, { bibliographic_id: params.bibId }),
        listLocations(params.orgId),
      ]);

      setBib(bibResult);
      setItems(itemsResult);
      setLocations(locationsResult);
    } catch (e) {
      setBib(null);
      setItems(null);
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次載入與路由參數改變時，重新抓資料。
  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.bibId]);

  // 當 bib 載入後，把現值填進表單（讓使用者能「從現況出發」編輯）。
  useEffect(() => {
    if (!bib) return;

    // 這裡只同步「欄位的目前值」，不自動勾選 update，避免誤送 PATCH。
    setTitle(bib.title);
    setCreators((bib.creators ?? []).join('\n'));
    setSubjects((bib.subjects ?? []).join('\n'));
    setPublisher(bib.publisher ?? '');
    setPublishedYear(bib.published_year?.toString() ?? '');
    setLanguage(bib.language ?? '');
    setIsbn(bib.isbn ?? '');
    setClassification(bib.classification ?? '');
  }, [bib]);

  async function onUpdateBib(e: React.FormEvent) {
    e.preventDefault();

    // PATCH payload：只放使用者有勾選的欄位（對齊 API 的「部分更新」設計）。
    const payload: {
      title?: string;
      creators?: string[] | null;
      subjects?: string[] | null;
      publisher?: string | null;
      published_year?: number | null;
      language?: string | null;
      isbn?: string | null;
      classification?: string | null;
    } = {};

    // title：不可清空；勾選就必須提供非空字串。
    if (updateTitle) {
      const trimmed = title.trim();
      if (!trimmed) {
        setError('title 不可為空（若不想改 title，請取消勾選）');
        return;
      }
      payload.title = trimmed;
    }

    // creators/subjects：允許用 null 清空（對齊 API update schema）。
    if (updateCreators) {
      const list = parseLines(creators);
      payload.creators = list ?? null;
    }
    if (updateSubjects) {
      const list = parseLines(subjects);
      payload.subjects = list ?? null;
    }

    // 可選字串欄位：空字串視為「清空」（送 null）；非空則送 trimmed string。
    if (updatePublisher) payload.publisher = publisher.trim() ? publisher.trim() : null;
    if (updateLanguage) payload.language = language.trim() ? language.trim() : null;
    if (updateIsbn) payload.isbn = isbn.trim() ? isbn.trim() : null;
    if (updateClassification)
      payload.classification = classification.trim() ? classification.trim() : null;

    // published_year：空字串 => null；非空 => int。
    if (updatePublishedYear) {
      const text = publishedYear.trim();
      if (!text) {
        payload.published_year = null;
      } else {
        const year = Number.parseInt(text, 10);
        if (!Number.isFinite(year)) {
          setError('published_year 必須是整數（或留空代表清空）');
          return;
        }
        payload.published_year = year;
      }
    }

    // 沒有任何欄位被勾選，就不送 request（避免 API 回 400）。
    if (Object.keys(payload).length === 0) {
      setError('請至少勾選一個要更新的欄位');
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      await updateBib(params.orgId, params.bibId, payload);
      setSuccess('已更新書目');

      // 更新後重新抓資料，確保畫面與 DB 一致（含可借冊數）。
      await refreshAll();

      // 更新成功後可以選擇保留勾選；MVP 先全部取消，避免下一次誤送。
      setUpdateTitle(false);
      setUpdateCreators(false);
      setUpdateSubjects(false);
      setUpdatePublisher(false);
      setUpdatePublishedYear(false);
      setUpdateLanguage(false);
      setUpdateIsbn(false);
      setUpdateClassification(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function onCreateItem(e: React.FormEvent) {
    e.preventDefault();

    const trimmedBarcode = barcode.trim();
    const trimmedCallNumber = callNumber.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedBarcode) {
      setError('barcode 不可為空');
      return;
    }
    if (!trimmedCallNumber) {
      setError('call_number 不可為空');
      return;
    }
    if (!locationId) {
      setError('請選擇 location');
      return;
    }

    setCreatingItem(true);
    setError(null);
    setSuccess(null);

    try {
      await createItem(params.orgId, params.bibId, {
        barcode: trimmedBarcode,
        call_number: trimmedCallNumber,
        location_id: locationId,
        status,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      });

      setSuccess('已新增冊');
      setBarcode('');
      setCallNumber('');
      setNotes('');

      // 新增冊後刷新：items 列表 + bib counts 都會更新。
      await refreshAll();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreatingItem(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Bib Detail</h1>

        <p className="muted">
          對應 API：<code>GET/PATCH /api/v1/orgs/:orgId/bibs/:bibId</code>，以及該書目底下的冊：
          <code>GET /api/v1/orgs/:orgId/items?bibliographic_id=</code>
        </p>

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            bibId：<code>{params.bibId}</code>
          </div>
        </div>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {bib ? (
          <div className="stack" style={{ marginTop: 16 }}>
            <div>
              <div className="muted">title</div>
              <div style={{ fontWeight: 700 }}>{bib.title}</div>
            </div>
            <div className="muted">
              isbn={bib.isbn ?? '(none)'} · classification={bib.classification ?? '(none)'} · available_items=
              {bib.available_items}/{bib.total_items}
            </div>
          </div>
        ) : null}
      </section>

      {/* 更新書目（PATCH） */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>更新書目（PATCH）</h2>
        <p className="muted">
          這裡用「勾選欄位」來組 PATCH payload：沒勾選的欄位不會送出（避免誤改）。
        </p>

        <form onSubmit={onUpdateBib} className="stack" style={{ marginTop: 12 }}>
          <label>
            <input type="checkbox" checked={updateTitle} onChange={(e) => setUpdateTitle(e.target.checked)} /> 更新 title
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!updateTitle} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateCreators}
              onChange={(e) => setUpdateCreators(e.target.checked)}
            />{' '}
            更新 creators（留空代表清空）
            <textarea
              value={creators}
              onChange={(e) => setCreators(e.target.value)}
              disabled={!updateCreators}
              rows={4}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateSubjects}
              onChange={(e) => setUpdateSubjects(e.target.checked)}
            />{' '}
            更新 subjects（留空代表清空）
            <textarea
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
              disabled={!updateSubjects}
              rows={4}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updatePublisher}
              onChange={(e) => setUpdatePublisher(e.target.checked)}
            />{' '}
            更新 publisher（留空代表清空）
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} disabled={!updatePublisher} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updatePublishedYear}
              onChange={(e) => setUpdatePublishedYear(e.target.checked)}
            />{' '}
            更新 published_year（留空代表清空）
            <input
              value={publishedYear}
              onChange={(e) => setPublishedYear(e.target.value)}
              disabled={!updatePublishedYear}
              placeholder="例：2000"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateLanguage}
              onChange={(e) => setUpdateLanguage(e.target.checked)}
            />{' '}
            更新 language（留空代表清空）
            <input value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!updateLanguage} />
          </label>

          <label>
            <input type="checkbox" checked={updateIsbn} onChange={(e) => setUpdateIsbn(e.target.checked)} /> 更新 isbn
            （留空代表清空）
            <input value={isbn} onChange={(e) => setIsbn(e.target.value)} disabled={!updateIsbn} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateClassification}
              onChange={(e) => setUpdateClassification(e.target.checked)}
            />{' '}
            更新 classification（留空代表清空）
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              disabled={!updateClassification}
            />
          </label>

          <button type="submit" disabled={updating}>
            {updating ? '更新中…' : '送出 PATCH'}
          </button>
        </form>
      </section>

      {/* 新增冊 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>新增冊（Item Copy）</h2>
        <p className="muted">
          對應 API：<code>POST /api/v1/orgs/:orgId/bibs/:bibId/items</code>（location 必須屬於同 org）。
        </p>

        <form onSubmit={onCreateItem} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              barcode（必填；同 org 內唯一）
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="例：LIB-00001234" />
            </label>

            <label>
              call_number（必填）
              <input
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="例：823.914 R79 v.1"
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              location（必填）
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">（請選擇）</option>
                {locationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              status（選填；預設 available）
              <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)}>
                <option value="available">available</option>
                <option value="checked_out">checked_out</option>
                <option value="on_hold">on_hold</option>
                <option value="lost">lost</option>
                <option value="withdrawn">withdrawn</option>
                <option value="repair">repair</option>
              </select>
            </label>
          </div>

          <label>
            notes（選填）
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>

          <button type="submit" disabled={creatingItem}>
            {creatingItem ? '新增中…' : '新增冊'}
          </button>
        </form>
      </section>

      {/* items 列表 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>冊列表（此書目底下）</h2>

        {items && items.length === 0 ? <p className="muted">此書目目前沒有冊。</p> : null}

        {items && items.length > 0 ? (
          <ul>
            {items.map((i) => (
              <li key={i.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div>
                    <Link href={`/orgs/${params.orgId}/items/${i.id}`}>{i.barcode}</Link>{' '}
                    <span className="muted">({i.status})</span>
                  </div>
                  <div className="muted">call_number={i.call_number}</div>
                  <div className="muted">location_id={i.location_id}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 讓使用者方便回到 bib 列表 */}
        <div style={{ marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/bibs`}>← 回到 Bibs</Link>
        </div>
      </section>
    </div>
  );
}

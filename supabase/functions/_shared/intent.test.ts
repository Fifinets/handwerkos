import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseIntentResponse } from './intent.ts';

Deno.test('parseIntentResponse: parses valid JSON', () => {
  const raw = '{"agent":"offers","action":"create","entities":{"customer":"Müller"}}';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'offers');
  assertEquals(result.action, 'create');
  assertEquals(result.entities.customer, 'Müller');
});

Deno.test('parseIntentResponse: strips markdown code fences', () => {
  const raw = '```json\n{"agent":"invoices","action":"check_overdue","entities":{}}\n```';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'invoices');
});

Deno.test('parseIntentResponse: strips plain code fences', () => {
  const raw = '```\n{"agent":"planning","action":"daily_briefing","entities":{}}\n```';
  const result = parseIntentResponse(raw);
  assertEquals(result.agent, 'planning');
});

Deno.test('parseIntentResponse: throws on invalid JSON', () => {
  assertThrows(
    () => parseIntentResponse('this is not json'),
    Error,
    'Intent classification did not return valid JSON',
  );
});

Deno.test('parseIntentResponse: throws on unknown agent', () => {
  const raw = '{"agent":"hacker","action":"create","entities":{}}';
  assertThrows(
    () => parseIntentResponse(raw),
    Error,
    'Unknown agent type',
  );
});

Deno.test('parseIntentResponse: throws on missing action', () => {
  const raw = '{"agent":"offers","entities":{}}';
  assertThrows(
    () => parseIntentResponse(raw),
    Error,
    'Missing required field: action',
  );
});

Deno.test('parseIntentResponse: defaults entities to empty object', () => {
  const raw = '{"agent":"offers","action":"create"}';
  const result = parseIntentResponse(raw);
  assertEquals(result.entities, {});
});

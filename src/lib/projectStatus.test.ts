import { describe, it, expect } from 'vitest';
import {
  PROJECT_STATUSES,
  WORKFLOW_STAGES,
  normalizeProjectStatus,
  statusForStage,
  projectStageLabel,
  projectStageStyle,
  isOpenProject,
  isProjectStatus,
  isWorkflowStage,
} from './projectStatus';

describe('projectStatus', () => {
  describe('normalizeProjectStatus', () => {
    it('lässt kanonische Paare unverändert', () => {
      expect(normalizeProjectStatus('active', 'in_progress')).toEqual({
        status: 'active',
        workflow_stage: 'in_progress',
      });
    });

    it('übersetzt deutsche Altwerte in das kanonische Paar', () => {
      expect(normalizeProjectStatus('in_bearbeitung')).toEqual({
        status: 'active',
        workflow_stage: 'in_progress',
      });
      expect(normalizeProjectStatus('anfrage')).toEqual({
        status: 'planned',
        workflow_stage: 'inquiry',
      });
      expect(normalizeProjectStatus('beauftragt')).toEqual({
        status: 'planned',
        workflow_stage: 'ordered',
      });
    });

    it('storniert hat nie eine Stufe — auch wenn eine mitgegeben wird', () => {
      expect(normalizeProjectStatus('storniert')).toEqual({
        status: 'cancelled',
        workflow_stage: null,
      });
      expect(normalizeProjectStatus('cancelled', 'done')).toEqual({
        status: 'cancelled',
        workflow_stage: null,
      });
    });

    it('leitet eine Stufe ab, wenn nur der Lebenszyklus bekannt ist', () => {
      expect(normalizeProjectStatus('planned').workflow_stage).toBe('ordered');
      expect(normalizeProjectStatus('completed').workflow_stage).toBe('done');
    });

    it('ignoriert eine unbekannte Stufe statt sie durchzureichen', () => {
      expect(normalizeProjectStatus('active', 'quatsch').workflow_stage).toBe('in_progress');
    });

    it('fällt bei unbekanntem oder fehlendem Status auf planned/inquiry zurück', () => {
      expect(normalizeProjectStatus('voellig_unbekannt')).toEqual({
        status: 'planned',
        workflow_stage: 'inquiry',
      });
      expect(normalizeProjectStatus(null)).toEqual({
        status: 'planned',
        workflow_stage: 'inquiry',
      });
      expect(normalizeProjectStatus(undefined)).toEqual({
        status: 'planned',
        workflow_stage: 'inquiry',
      });
    });
  });

  describe('statusForStage', () => {
    it('ordnet jede Stufe einem Lebenszyklus zu', () => {
      for (const stage of WORKFLOW_STAGES) {
        expect(PROJECT_STATUSES).toContain(statusForStage(stage));
      }
    });

    it('bildet die fachliche Reihenfolge ab', () => {
      expect(statusForStage('inquiry')).toBe('planned');
      expect(statusForStage('ordered')).toBe('planned');
      expect(statusForStage('in_progress')).toBe('active');
      expect(statusForStage('acceptance')).toBe('active');
      expect(statusForStage('done')).toBe('completed');
    });

    it('erzeugt nie cancelled — das ist kein Ergebnis einer Stufe', () => {
      for (const stage of WORKFLOW_STAGES) {
        expect(statusForStage(stage)).not.toBe('cancelled');
      }
    });
  });

  describe('Anzeige', () => {
    it('zeigt deutsche Bezeichnungen', () => {
      expect(projectStageLabel('active', 'in_progress')).toBe('In Bearbeitung');
      expect(projectStageLabel('in_bearbeitung')).toBe('In Bearbeitung');
      expect(projectStageLabel('cancelled')).toBe('Storniert');
    });

    it('gibt für storniert die rote Kennzeichnung zurück', () => {
      expect(projectStageStyle('cancelled')).toContain('red');
      expect(projectStageStyle('storniert')).toContain('red');
    });

    it('unterscheidet die Stufen farblich', () => {
      const styles = WORKFLOW_STAGES.map((s) => projectStageStyle(statusForStage(s), s));
      expect(new Set(styles).size).toBe(WORKFLOW_STAGES.length);
    });
  });

  describe('isOpenProject', () => {
    it('zählt geplant und aktiv als offen', () => {
      expect(isOpenProject('planned')).toBe(true);
      expect(isOpenProject('active')).toBe(true);
      expect(isOpenProject('anfrage')).toBe(true);
      expect(isOpenProject('in_bearbeitung')).toBe(true);
    });

    it('zählt abgeschlossen und storniert nicht als offen', () => {
      expect(isOpenProject('completed')).toBe(false);
      expect(isOpenProject('cancelled')).toBe(false);
      expect(isOpenProject('abgeschlossen')).toBe(false);
      expect(isOpenProject('storniert')).toBe(false);
    });
  });

  describe('Typwächter', () => {
    it('erkennt gültige Werte', () => {
      expect(isProjectStatus('active')).toBe(true);
      expect(isProjectStatus('in_bearbeitung')).toBe(false);
      expect(isWorkflowStage('in_progress')).toBe(true);
      expect(isWorkflowStage('active')).toBe(false);
      expect(isProjectStatus(null)).toBe(false);
      expect(isWorkflowStage(42)).toBe(false);
    });
  });
});

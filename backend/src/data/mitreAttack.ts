// A curated subset of MITRE ATT&CK (Enterprise) tactics and techniques —
// enough to give the detection engine real, citable technique IDs without
// vendoring the entire 600+ technique STIX corpus.
// Source taxonomy: https://attack.mitre.org/

export interface MitreTechnique {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
}

export const MITRE_TECHNIQUES: Record<string, MitreTechnique> = {
  T1110: {
    tacticId: 'TA0006',
    tacticName: 'Credential Access',
    techniqueId: 'T1110',
    techniqueName: 'Brute Force',
  },
  T1110_003: {
    tacticId: 'TA0006',
    tacticName: 'Credential Access',
    techniqueId: 'T1110.003',
    techniqueName: 'Password Spraying',
  },
  T1078: {
    tacticId: 'TA0001',
    tacticName: 'Initial Access',
    techniqueId: 'T1078',
    techniqueName: 'Valid Accounts',
  },
  T1595: {
    tacticId: 'TA0043',
    tacticName: 'Reconnaissance',
    techniqueId: 'T1595',
    techniqueName: 'Active Scanning',
  },
  T1046: {
    tacticId: 'TA0007',
    tacticName: 'Discovery',
    techniqueId: 'T1046',
    techniqueName: 'Network Service Discovery',
  },
  T1071: {
    tacticId: 'TA0011',
    tacticName: 'Command and Control',
    techniqueId: 'T1071',
    techniqueName: 'Application Layer Protocol',
  },
  T1485: {
    tacticId: 'TA0040',
    tacticName: 'Impact',
    techniqueId: 'T1485',
    techniqueName: 'Data Destruction',
  },
  T1567: {
    tacticId: 'TA0010',
    tacticName: 'Exfiltration',
    techniqueId: 'T1567',
    techniqueName: 'Exfiltration Over Web Service',
  },
  T1098: {
    tacticId: 'TA0003',
    tacticName: 'Persistence',
    techniqueId: 'T1098',
    techniqueName: 'Account Manipulation',
  },
  T1059: {
    tacticId: 'TA0002',
    tacticName: 'Execution',
    techniqueId: 'T1059',
    techniqueName: 'Command and Scripting Interpreter',
  },
  T1070: {
    tacticId: 'TA0005',
    tacticName: 'Defense Evasion',
    techniqueId: 'T1070',
    techniqueName: 'Indicator Removal',
  },
  T1021: {
    tacticId: 'TA0008',
    tacticName: 'Lateral Movement',
    techniqueId: 'T1021',
    techniqueName: 'Remote Services',
  },
};

// Ordered list of tactic columns for the dashboard's tactic-grid heatmap —
// follows the canonical MITRE ATT&CK kill-chain ordering.
export const TACTIC_ORDER = [
  'TA0043', // Reconnaissance
  'TA0001', // Initial Access
  'TA0002', // Execution
  'TA0003', // Persistence
  'TA0005', // Defense Evasion
  'TA0006', // Credential Access
  'TA0007', // Discovery
  'TA0008', // Lateral Movement
  'TA0011', // Command and Control
  'TA0010', // Exfiltration
  'TA0040', // Impact
];

export const TACTIC_NAMES: Record<string, string> = {
  TA0043: 'Reconnaissance',
  TA0001: 'Initial Access',
  TA0002: 'Execution',
  TA0003: 'Persistence',
  TA0005: 'Defense Evasion',
  TA0006: 'Credential Access',
  TA0007: 'Discovery',
  TA0008: 'Lateral Movement',
  TA0011: 'Command and Control',
  TA0010: 'Exfiltration',
  TA0040: 'Impact',
};

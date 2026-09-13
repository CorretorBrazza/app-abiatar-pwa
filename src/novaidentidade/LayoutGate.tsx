// Portão da camada visual: escolhe entre a interface clássica e a nova identidade.
// A clássica permanece intacta; a nova é renderizada quando o flag (URL/env/tenant) ativa.

import React from 'react';
import Dashboard from '../screens/Dashboard';
import DashboardNova from './DashboardNova';
import { useLayoutFlag } from './useLayoutFlag';

export default function LayoutGate() {
  const { isNova } = useLayoutFlag();
  return isNova ? <DashboardNova /> : <Dashboard />;
}
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LogOut,
  RefreshCw,
  UserCheck,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow } from './tokens';
import type { NovaView } from './workspaces';

function formatTime(iso?: string | null) {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(iso);
  }
}

interface Props {
  isMobile: boolean;
  onOpen: (v: NovaView) => void;
  onCheckOutDone: () => void;
}

export default function NovaShiftActive({ isMobile, onOpen, onCheckOutDone }: Props) {
  const [current, setCurrent] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const [curRes, sumRes] = await Promise.all([
        api.get('/presences/current'),
        api.get('/presences/dashboard-summary'),
      ]);
      setCurrent(curRes.data);
      setSummary(sumRes.data);
      setLastUpdated(Date.now());
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const loadData = async () => {
      if (cancelled) return;
      try {
        const [curRes, sumRes] = await Promise.all([
          api.get('/presences/current'),
          api.get('/presences/dashboard-summary'),
        ]);
        if (!cancelled) {
          setCurrent(curRes.data);
          setSummary(sumRes.data);
          setLastUpdated(Date.now());
        }
      } catch {
        /* silencioso */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    timer = setInterval(loadData, 10000);

    const onRealtime = () => loadData();
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:realtime', onRealtime);
      window.addEventListener('abiatar:booth_update', onRealtime);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:realtime', onRealtime);
        window.removeEventListener('abiatar:booth_update', onRealtime);
      }
    };
  }, []);

  const pendingPingId = current?.presence?.pendingPingId ?? null;
  const presenceStatus = current?.presence?.status as string | undefined;
  const activeShift = summary?.activeShift ?? null;

  const confirmPresence = useCallback(async () => {
    if (!pendingPingId) return;
    try {
      setConfirming(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('A confirmação exige permissão de localização.');
      }
      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        location = await Location.getLastKnownPositionAsync();
        const ageMs = Date.now() - ((location as any)?.timestamp ?? 0);
        if (!location || ageMs > 60_000) {
          throw new Error('Não foi possível obter sinal de GPS recente. Verifique sua conexão e tente novamente.');
        }
      }
      const capturedAt = Date.now();
      await api.post('/presences/ping-response', {
        pingLogId: pendingPingId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        capturedAt,
      });
      Alert.alert('Presença confirmada', 'Seu turno continua ativo. A próxima confirmação será calculada automaticamente.');
      await fetchData();
    } catch (e: any) {
      Alert.alert('Não foi possível confirmar', e?.response?.data?.message || e?.message || 'Tente novamente.');
    } finally {
      setConfirming(false);
    }
  }, [pendingPingId, fetchData]);

  const handleCheckOut = useCallback(async () => {
    try {
      setEnding(true);
      const res = await api.post('/presences/check-out');
      Alert.alert('Turno finalizado', `Tempo de permanência: ${res.data.totalMinutes} minutos.`);
      setCurrent(null);
      setSummary(null);
      onCheckOutDone();
    } catch (e: any) {
      Alert.alert('Falha ao realizar check-out.', e?.response?.data?.message || 'Tente novamente.');
    } finally {
      setEnding(false);
    }
  }, [onCheckOutDone]);

  if (loading) {
    return <View style={s.center}><Text style={fonts.bodySmall}>Carregando seu turno…</Text></View>;
  }

  if (!current?.hasActiveSession && !activeShift) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.emptyTitle}>Você não está em plantão</Text>
          <Text style={s.emptyDesc}>Escolha um plantão disponível e faça o check-in para iniciar seu turno.</Text>
          <TouchableOpacity style={s.btnPrimary} onPress={() => onOpen('check_in')} activeOpacity={0.9}>
            <UserCheck size={16} color="#fff" strokeWidth={2.2} />
            <Text style={s.btnPrimaryText}>Ir para o check-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (pendingPingId) {
    return (
      <View style={s.center}>
        <View style={[s.card, { borderColor: colors.amber700, backgroundColor: '#FFFCF5' }]}>
          <View style={s.pingBadge}>
            <AlertTriangle size={14} color={colors.amber700} />
            <Text style={s.pingBadgeText}>CONFIRMAÇÃO OBRIGATÓRIA</Text>
          </View>
          <Text style={s.pingTitle}>Você ainda está no plantão?</Text>
          <Text style={s.pingBody}>
            A confirmação é obrigatória para manter sua presença e continuar elegível aos leads.
          </Text>
          <Text style={s.pingBody}>
            Ao confirmar, sua localização será validada por GPS ou Wi-Fi, sem rastreamento contínuo.
          </Text>
          <View style={s.pingActions}>
            <TouchableOpacity style={s.btnPrimary} onPress={confirmPresence} disabled={confirming || ending} activeOpacity={0.9}>
              {confirming ? <RefreshCw size={15} color="#fff" /> : <CheckCircle2 size={15} color="#fff" strokeWidth={2.2} />}
              <Text style={s.btnPrimaryText}>{confirming ? 'Validando…' : 'Sim, no plantão'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDangerOutline} onPress={handleCheckOut} disabled={confirming || ending} activeOpacity={0.9}>
              <LogOut size={15} color={colors.red700} strokeWidth={2} />
              <Text style={s.btnDangerText}>Finalizar turno</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (presenceStatus === 'absent') {
    return (
      <View style={s.center}>
        <View style={[s.card, { backgroundColor: '#7C2D12', borderColor: '#B45309' }]}>
          <Text style={s.absentTitle}>⚠️ Presença suspensa por ausência</Text>
          <Text style={s.absentBody}>
            Você não respondeu à confirmação de permanência e seu turno está em pausa.
            Se estiver no plantão, solicite a validação na recepção.
            Sua posição na fila da roleta será mantida após a revalidação.
          </Text>
          <TouchableOpacity style={s.btnWhite} onPress={handleCheckOut} disabled={ending} activeOpacity={0.9}>
            <LogOut size={15} color={colors.navy900} strokeWidth={2} />
            <Text style={s.btnWhiteText}>{ending ? 'Finalizando…' : 'Encerrar turno'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roletaName = activeShift?.roletaName;
  const roletaEntryType = activeShift?.roletaEntryType as string | undefined;
  const isPosBarra = roletaEntryType === 'pos_barra';
  const boothName = activeShift?.boothName || current?.presence?.boothName || 'Plantão Ativo';
  const checkInAtFormatted = activeShift?.checkInAtFormatted;
  const attendedAt = activeShift?.attendedAt;
  const effectivePosition = activeShift?.effectivePosition;
  const roletaPosition = activeShift?.roletaPosition;
  const waitingDraw = activeShift?.waitingDraw;
  const waitingBrokersCount = activeShift?.waitingBrokersCount ?? 0;
  const drawTimeFormatted = activeShift?.drawTimeFormatted || '09:01';
  const boothQueue: any[] = activeShift?.boothQueue || [];
  const activeMinutes = activeShift?.activeMinutes ?? 0;
  const minimumMinutes = activeShift?.minimumMinutes ?? 120;
  const minimumReached = activeShift?.minimumReached ?? activeMinutes >= minimumMinutes;
  const accumulatedPeriods = summary?.accumulatedPeriods ?? 0;
  const nextConfirmationAt = activeShift?.nextConfirmationAt;
  const confirmationToleranceMinutes = activeShift?.confirmationToleranceMinutes ?? 5;
  const lastConfirmedAt = activeShift?.lastConfirmedAt;

  const updatedLabel = lastUpdated ? `Atualizado às ${new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.hero, { backgroundImage: `linear-gradient(115deg, ${colors.navy800}, ${colors.navy700})` } as any]}>
        <View style={s.heroHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.heroBadge}>
              <CheckCircle2 size={12} color="#fff" />
              <Text style={s.heroBadgeText}>VOCÊ ESTÁ EM PLANTÃO</Text>
            </View>
            <Text style={s.heroTitle}>{boothName}</Text>
            <Text style={s.heroSub}>
              Check-in às {checkInAtFormatted || '--:--'}
              {roletaName ? ` · ${roletaName}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={s.heroRefresh} onPress={fetchData} activeOpacity={0.8}>
            <RefreshCw size={14} color="rgba(255,255,255,0.85)" />
            <Text style={s.heroRefreshText}>{updatedLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {attendedAt ? (
        <View style={s.card}>
          <View style={[s.stateRow, { backgroundColor: colors.green100 }]}>
            <CheckCircle2 size={18} color={colors.green700} />
            <Text style={{ color: colors.green700, fontWeight: '800', fontFamily: font.body, fontSize: 12 }}>ATENDIMENTO REALIZADO</Text>
          </View>
          {roletaName && (
            <View style={[s.pill, isPosBarra ? { backgroundColor: colors.amber100 } : { backgroundColor: colors.green100 }]}>
              <Text style={[s.pillText, isPosBarra ? { color: colors.amber700 } : { color: colors.green700 }]}>
                {isPosBarra ? 'PÓS-BARRA' : roletaName}
              </Text>
            </View>
          )}
          <Text style={s.body}>Você foi atendido na recepção.</Text>
          <Text style={s.bodyMuted}>Atendimento registrado às: {formatTime(attendedAt)}</Text>
          <Text style={s.bodyMuted}>Sua posição na roleta foi concluída. Continue online para manter o turno ativo.</Text>
        </View>
      ) : roletaPosition || effectivePosition ? (
        <View style={s.card}>
          <Text style={{ color: colors.navy800, fontFamily: font.display, fontWeight: '800', fontSize: 13 }}>{roletaName || 'Roleta Oficial'}</Text>
          <View style={[s.pill, isPosBarra ? { backgroundColor: colors.amber100 } : { backgroundColor: colors.blue100 }]}>
            <Text style={[s.pillText, isPosBarra ? { color: colors.amber700 } : { color: colors.blue700 }]}>
              {isPosBarra ? 'PÓS-BARRA' : 'SORTEIO NA ROLETA'}
            </Text>
          </View>
          <Text style={s.metricBig}>{effectivePosition || roletaPosition}º Lugar na Fila</Text>
          <Text style={s.bodyMuted}>Check-in realizado às: {checkInAtFormatted || '--:--'}</Text>
          <Text style={s.bodyMuted}>Horário do sorteio: às {drawTimeFormatted}</Text>
          <Text style={[s.bodyMuted, { marginTop: 4 }]}>
            {isPosBarra ? 'Atendimento extra / Final da fila' : 'Aguarde ser anunciado na recepção'}
          </Text>
        </View>
      ) : waitingDraw ? (
        <View style={s.card}>
          <View style={[s.pill, { backgroundColor: colors.blue100 }]}>
            <Clock3 size={12} color={colors.blue700} />
            <Text style={[s.pillText, { color: colors.blue700 }]}>AGUARDANDO SORTEIO DA ROLETA</Text>
          </View>
          <Text style={s.body}>Check-in Pontual Confirmado!</Text>
          <Text style={s.bodyMuted}>Horário do Sorteio: às {drawTimeFormatted}</Text>
          <Text style={s.bodyMuted}>Aguardando no estande: {waitingBrokersCount} corretor(es)</Text>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={{ color: colors.navy800, fontWeight: '800', fontFamily: font.body, fontSize: 13 }}>Turno Ativo no Plantão</Text>
          <Text style={s.body}>Você está online e apto a receber clientes e leads.</Text>
        </View>
      )}

      {boothQueue.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Fila da roleta no plantão ({boothQueue.length})</Text>
          {boothQueue.map((item: any, idx: number) => (
            <View
              key={item.brokerId || idx}
              style={[
                s.queueRow,
                item.isCurrentBroker ? { borderColor: '#3B82F6', borderWidth: 1.5 } : {},
              ]}
            >
              <View style={s.queueCircle}>
                <Text style={s.queueCircleText}>{item.effectivePosition || item.roletaPosition || idx + 1}º</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.queueName}>
                  {item.nomeGuerra}{' '}
                  {item.isCurrentBroker && <Text style={{ color: '#2563EB' }}>(Você)</Text>}
                </Text>
                <Text style={s.queueDetail}>
                  {item.roletaEntryType === 'pos_barra' ? 'Pós-Barra' : 'Sorteio Pontual'} · {item.minutesActive} min cumpridos
                </Text>
              </View>
              <View style={s.queueDot} />
            </View>
          ))}
        </View>
      )}

      <View style={s.card}>
        <Text style={s.sectionTitle}>Validação da roleta em tempo real</Text>
        <Text style={s.body}>
          Roletas acumuladas na semana: <Text style={{ fontWeight: '800' }}>{accumulatedPeriods}</Text>
        </Text>
        <Text style={s.body}>
          Tempo cumprido no turno: <Text style={{ fontWeight: '800' }}>{activeMinutes} min</Text> / {minimumMinutes} min
        </Text>
        {minimumReached && (
          <View style={[s.pill, { backgroundColor: colors.green100, alignSelf: 'flex-start', marginTop: 6 }]}>
            <CheckCircle2 size={11} color={colors.green700} />
            <Text style={[s.pillText, { color: colors.green700 }]}>Mínimo atingido</Text>
          </View>
        )}
        {nextConfirmationAt && (
          <Text style={[s.bodyMuted, { marginTop: 8 }]}>
            Próxima confirmação de presença: {formatTime(nextConfirmationAt)} (+{confirmationToleranceMinutes} min de tolerância)
          </Text>
        )}
        {lastConfirmedAt && (
          <Text style={s.bodyMuted}>Última confirmação: {formatTime(lastConfirmedAt)}</Text>
        )}
        {(summary?.invalidatedPeriods ?? 0) > 0 && (
          <Text style={{ color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 11, marginTop: 6 }}>
            Períodos invalidados: {summary.invalidatedPeriods}
          </Text>
        )}
      </View>

      <View style={s.footerActions}>
        <TouchableOpacity style={s.btnDangerFull} onPress={handleCheckOut} disabled={ending} activeOpacity={0.9}>
          {ending ? <RefreshCw size={15} color="#fff" /> : <LogOut size={15} color="#fff" strokeWidth={2} />}
          <Text style={s.btnDangerFullText}>{ending ? 'Finalizando…' : 'Finalizar Turno'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: 32, paddingHorizontal: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: 18,
    gap: 8,
    ...shadow.card,
  },
  emptyTitle: { fontFamily: font.display, fontWeight: '800', fontSize: 17, color: semantic.textPrimary, marginBottom: 4 },
  emptyDesc: { ...fonts.body, color: semantic.textSecondary, marginBottom: 12 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.coral600,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  btnPrimaryText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  btnDangerOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.red300,
    backgroundColor: colors.red100,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  btnDangerText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  pingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber100,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: 4,
  },
  pingBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5, color: colors.amber700 },
  pingTitle: { fontFamily: font.display, fontWeight: '800', fontSize: 22, color: '#9A3412', lineHeight: 26, marginTop: 4 },
  pingBody: { fontFamily: font.body, fontWeight: '400', fontSize: 12.5, color: '#78350F', lineHeight: 18 },
  pingActions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  absentTitle: { fontFamily: font.display, fontWeight: '800', fontSize: 15, color: '#FEF3C7', marginBottom: 4 },
  absentBody: { fontFamily: font.body, fontWeight: '400', fontSize: 12.5, color: '#FED7AA', lineHeight: 18, marginBottom: 14 },
  btnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#fff',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  btnWhiteText: { color: colors.navy900, fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  hero: {
    borderRadius: 13,
    padding: 22,
    gap: 10,
    marginBottom: 0,
    shadowColor: '#101C2A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 8,
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 22, lineHeight: 25 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontFamily: font.body, fontWeight: '500', fontSize: 12, marginTop: 4 },
  heroRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  heroRefreshText: { color: 'rgba(255,255,255,0.85)', fontFamily: font.body, fontWeight: '600', fontSize: 10 },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  metricBig: {
    fontFamily: font.display,
    fontWeight: '800',
    fontSize: 26,
    lineHeight: 28,
    color: semantic.textPrimary,
    marginTop: 6,
  },
  body: { fontFamily: font.body, fontWeight: '500', fontSize: 12.5, color: semantic.textBody, lineHeight: 18 },
  bodyMuted: { fontFamily: font.body, fontWeight: '400', fontSize: 11.5, color: semantic.textMuted, lineHeight: 16 },
  sectionTitle: { fontFamily: font.display, fontWeight: '800', fontSize: 13.5, color: semantic.textPrimary, marginBottom: 4 },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FDE8E6',
    borderWidth: 1,
    borderColor: '#F0B5AB',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  queueCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueCircleText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 11 },
  queueName: { fontFamily: font.body, fontWeight: '700', fontSize: 12, color: semantic.textPrimary },
  queueDetail: { fontFamily: font.body, fontWeight: '400', fontSize: 10.5, color: colors.slate500, marginTop: 2 },
  queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green500 },
  footerActions: { marginTop: 6 },
  btnDangerFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.coral600,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  btnDangerFullText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 13 },
});

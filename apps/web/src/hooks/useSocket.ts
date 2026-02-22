import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';

export function useSocket() {
  const store = useSessionStore();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      store.setConnected(true);
    });

    socket.on('disconnect', () => {
      store.setConnected(false);
    });

    socket.on('session:error', (data) => {
      store.setError(data.message);
    });

    socket.on('session:state', (data) => {
      store.setSessionState(data);
    });

    socket.on('session:created', (data) => {
      store.setUserId(data.userId);
    });

    socket.on('session:started', (data) => {
      store.updateSession({ status: 'running' });
      store.setSimClock(data.simClockMs);
    });

    socket.on('session:paused', (data) => {
      store.updateSession({ status: 'paused' });
      store.setSimClock(data.simClockMs);
    });

    socket.on('session:ended', (data) => {
      store.updateSession({ status: 'ended' });
      store.setDebrief(data.debrief);
    });

    socket.on('clock:tick', (data) => {
      store.setSimClock(data.simClockMs);
    });

    socket.on('user:joined', (data) => {
      store.addUser(data.user);
    });

    socket.on('user:assigned', (data) => {
      store.assignPatient(data.userId, data.patientId);
    });

    socket.on('patient:vitalsUpdate', (data) => {
      store.updatePatientVitals(
        data.patientId,
        data.vitals,
        data.status,
        data.fetalStatus,
        data.ctgSummary,
      );
    });

    socket.on('patient:arrived', (data) => {
      store.addPatient(data.patient);
    });

    socket.on('patient:statusChange', (data) => {
      store.addAlert({
        patientId: data.patientId,
        message: `Patient status: ${data.oldStatus} → ${data.newStatus}`,
        severity:
          data.newStatus === 'collapsed'
            ? 'critical'
            : data.newStatus === 'critical'
              ? 'high'
              : 'medium',
      });
    });

    socket.on('action:pending', (data) => {
      store.addPendingAction(data.patientId, data.actionKey, data.delayMs);
    });

    socket.on('action:result', (data) => {
      store.setActionResult(data.patientId, data.actionKey, data.result);
    });

    socket.on('event:logged', (data) => {
      store.addEvent(data.event);
    });

    socket.on('resource:changed', (data) => {
      const updates: Record<string, boolean> = {};
      if (data.resource === 'ketometer') updates.ketometerAvailable = data.available;
      if (data.resource === 'labs') updates.labsAvailable = data.available;
      if (data.resource === 'staff') updates.staffAvailable = data.available;
      store.setResources(updates);
    });

    socket.on('alert:fire', (data) => {
      store.addAlert({
        patientId: data.patientId,
        message: data.message,
        severity: data.severity,
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:error');
      socket.off('session:state');
      socket.off('session:created');
      socket.off('session:started');
      socket.off('session:paused');
      socket.off('session:ended');
      socket.off('clock:tick');
      socket.off('user:joined');
      socket.off('user:assigned');
      socket.off('patient:vitalsUpdate');
      socket.off('patient:arrived');
      socket.off('patient:statusChange');
      socket.off('action:pending');
      socket.off('action:result');
      socket.off('event:logged');
      socket.off('resource:changed');
      socket.off('alert:fire');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return socket;
}

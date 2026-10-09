socket.on('toggleChaining', ({ enabled }) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.gameStarted) return;

    room.chainingEnabled = Boolean(enabled);
    io.to(room.code).emit('settingsUpdated', {
      chainingEnabled: room.chainingEnabled,
      championLocking: room.championLocking,
      roundDuration: room.roundDuration
    });
  });

  socket.on('toggleChampionLocking', ({ enabled }) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.gameStarted) return;

    room.championLocking = Boolean(enabled);
    io.to(room.code).emit('settingsUpdated', {
      chainingEnabled: room.chainingEnabled,
      championLocking: room.championLocking,
      roundDuration: room.roundDuration
    });
  });

  socket.on('setRoundDuration', ({ duration }) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.gameStarted) return;

    const parsed = parseInt(duration, 10);
    if ([30, 60, 0].includes(parsed)) {
      room.roundDuration = parsed;
      io.to(room.code).emit('settingsUpdated', {
        chainingEnabled: room.chainingEnabled,
        championLocking: room.championLocking,
        roundDuration: room.roundDuration
      });
    }
  });
const { drivers, adminMessages, rides } = require('../../data/memory');

// Επιστρέφει πληροφορίες για το dashboard του οδηγού
exports.getDashboardData = (req, res) => {
  const driverId = req.params.id;

  const driver = drivers.find((d) => d.id === driverId && d.role === 'driver');
  if (!driver) {
    return res.status(404).json({ success: false, message: 'Ο οδηγός δεν βρέθηκε.' });
  }

  // Φιλτράρουμε τα μηνύματα admin προς οδηγούς (αν υπάρχουν)
  const messages = adminMessages.slice(-10).map((m) => ({
    id: m.id,
    content: m.content,
    date: m.date,
  }));

  // Στατιστικά διαδρομών τελευταίων 6 μηνών
  const now = new Date();
  const rideStats = {};

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    const ridesInMonth = rides.filter((r) => {
      const rDate = new Date(r.date);
      return (
        r.driverId === driverId &&
        rDate.getFullYear() === date.getFullYear() &&
        rDate.getMonth() === date.getMonth()
      );
    });

    rideStats[key] = {
      successful: ridesInMonth.filter((r) => r.status === 'successful').length,
      failed: ridesInMonth.filter((r) => r.status === 'failed').length,
      problematic: ridesInMonth.filter((r) => r.status === 'problematic').length,
    };
  }

  res.json({
    success: true,
    data: {
      driver: {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        carNumber: driver.carNumber,
        average_rating: driver.average_rating,
      },
      messages,
      rideStats,
    },
  });
};

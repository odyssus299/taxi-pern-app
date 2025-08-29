// /**
//  * Dev-only in-memory data.
//  * ΣΚΟΠΙΜΑ: plaintext password για να ταιριάζει με το frontend mock (θα αλλάξει με bcrypt αργότερα).
//  */
// const admins = [
//     {
//       id: 'admin-001',
//       firstName: 'Super',
//       lastName: 'Admin',
//       email: 'admin@taxikavala.gr',
//       phone: '6999999999',
//       password: 'AdminPass!123',
//       role: 'admin'
//     }
//   ];
  
//   const drivers = [
//     {
//       id: 'driver-101',
//       firstName: 'Νίκος',
//       lastName: 'Νικολάου',
//       carNumber: 'ΚΒΑ-1234',
//       email: 'driver@taxikavala.gr',
//       phone: '6912345678',
//       password: 'DriverPass!123',
//       status: 'available',
//       location: { lat: 40.9363, lng: 24.4085 },
//       average_rating: 4.8,
//       ratingCount: 15, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-102',
//       firstName: 'Ελένη',
//       lastName: 'Παππά',
//       carNumber: 'ΚΒΙ-5678',
//       email: 'driver2@taxikavala.gr',
//       phone: '6923456789',
//       password: 'DriverPass!456',
//       status: 'on_ride',
//       location: { lat: 40.9120, lng: 24.3310 },
//       average_rating: 4.5,
//       ratingCount: 22,
//       role: 'driver',
//     },
//     {
//       id: 'driver-103',
//       firstName: 'Κώστας',
//       lastName: 'Γεωργίου',
//       carNumber: 'ΚΒΧ-9101',
//       email: 'driver3@taxikavala.gr',
//       phone: '6934567890',
//       password: 'DriverPass!789',
//       status: 'offline',
//       location: { lat: 40.9450, lng: 24.4280 },
//       average_rating: 5.0,
//       ratingCount: 10,
//       role: 'driver',
//     },
//     // Οι 17 νέοι οδηγοί
//     {
//       id: 'driver-104',
//       firstName: 'Μαρία',
//       lastName: 'Ιωαννίδου',
//       carNumber: 'ΚΒΜ-1122',
//       email: 'driver4@taxikavala.gr',
//       phone: '6945678901',
//       password: 'DriverPass!104',
//       status: 'available',
//       location: { lat: 40.9380, lng: 24.4110 },
//       average_rating: 4.9,
//       ratingCount: 35, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-105',
//       firstName: 'Γιώργος',
//       lastName: 'Αντωνίου',
//       carNumber: 'ΚΒΑ-3344',
//       email: 'driver5@taxikavala.gr',
//       phone: '6956789012',
//       password: 'DriverPass!105',
//       status: 'available',
//       location: { lat: 40.9325, lng: 24.4050 },
//       average_rating: 4.7,
//       ratingCount: 18, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-106',
//       firstName: 'Σοφία',
//       lastName: 'Δημητρίου',
//       carNumber: 'ΚΒΖ-5566',
//       email: 'driver6@taxikavala.gr',
//       phone: '6967890123',
//       password: 'DriverPass!106',
//       status: 'offline',
//       location: { lat: 40.9400, lng: 24.4150 },
//       average_rating: 4.6,
//       ratingCount: 25, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-107',
//       firstName: 'Αλέξανδρος',
//       lastName: 'Βασιλείου',
//       carNumber: 'ΚΒΗ-7788',
//       email: 'driver7@taxikavala.gr',
//       phone: '6978901234',
//       password: 'DriverPass!107',
//       status: 'on_ride',
//       location: { lat: 40.9300, lng: 24.3900 },
//       average_rating: 4.9,
//       ratingCount: 40, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-108',
//       firstName: 'Κατερίνα',
//       lastName: 'Πέτρου',
//       carNumber: 'ΚΒΘ-9900',
//       email: 'driver8@taxikavala.gr',
//       phone: '6989012345',
//       password: 'DriverPass!108',
//       status: 'available',
//       location: { lat: 40.9350, lng: 24.4000 },
//       average_rating: 4.2,
//       ratingCount: 12, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-109',
//       firstName: 'Δημήτρης',
//       lastName: 'Σάββας',
//       carNumber: 'ΚΒΚ-1212',
//       email: 'driver9@taxikavala.gr',
//       phone: '6990123456',
//       password: 'DriverPass!109',
//       status: 'available',
//       location: { lat: 40.9390, lng: 24.4180 },
//       average_rating: 5.0,
//       ratingCount: 50, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-110',
//       firstName: 'Χρήστος',
//       lastName: 'Μιχαηλίδης',
//       carNumber: 'ΚΒΛ-3434',
//       email: 'driver10@taxikavala.gr',
//       phone: '6901234567',
//       password: 'DriverPass!110',
//       status: 'offline',
//       location: { lat: 40.9280, lng: 24.3950 },
//       average_rating: 4.4,
//       ratingCount: 28, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-111',
//       firstName: 'Αντώνης',
//       lastName: 'Κωνσταντινίδης',
//       carNumber: 'ΚΒΝ-5656',
//       email: 'driver11@taxikavala.gr',
//       phone: '6911223344',
//       password: 'DriverPass!111',
//       status: 'available',
//       location: { lat: 40.9420, lng: 24.4220 },
//       average_rating: 4.8,
//       ratingCount: 19, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-112',
//       firstName: 'Βασιλική',
//       lastName: 'Γρηγορίου',
//       carNumber: 'ΚΒΞ-7878',
//       email: 'driver12@taxikavala.gr',
//       phone: '6922334455',
//       password: 'DriverPass!112',
//       status: 'on_ride',
//       location: { lat: 40.9310, lng: 24.4010 },
//       average_rating: 4.1,
//       ratingCount: 33, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-113',
//       firstName: 'Παναγιώτης',
//       lastName: 'Ηλιάδης',
//       carNumber: 'ΚΒΟ-9090',
//       email: 'driver13@taxikavala.gr',
//       phone: '6933445566',
//       password: 'DriverPass!113',
//       status: 'available',
//       location: { lat: 40.9375, lng: 24.4095 },
//       average_rating: 4.9,
//       ratingCount: 45, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-114',
//       firstName: 'Ιωάννα',
//       lastName: 'Τριανταφύλλου',
//       carNumber: 'ΚΒΡ-2468',
//       email: 'driver14@taxikavala.gr',
//       phone: '6944556677',
//       password: 'DriverPass!114',
//       status: 'offline',
//       location: { lat: 40.9450, lng: 24.4250 },
//       average_rating: 4.7,
//       ratingCount: 21, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-115',
//       firstName: 'Στέφανος',
//       lastName: 'Αποστόλου',
//       carNumber: 'ΚΒΣ-1357',
//       email: 'driver15@taxikavala.gr',
//       phone: '6955667788',
//       password: 'DriverPass!115',
//       status: 'available',
//       location: { lat: 40.9330, lng: 24.4130 },
//       average_rating: 4.6,
//       ratingCount: 14, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-116',
//       firstName: 'Αναστασία',
//       lastName: 'Ζαφειρίου',
//       carNumber: 'ΚΒΤ-8024',
//       email: 'driver16@taxikavala.gr',
//       phone: '6966778899',
//       password: 'DriverPass!116',
//       status: 'on_ride',
//       location: { lat: 40.9295, lng: 24.3980 },
//       average_rating: 4.9,
//       ratingCount: 38, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-117',
//       firstName: 'Θεόδωρος',
//       lastName: 'Μακρής',
//       carNumber: 'ΚΒΥ-6802',
//       email: 'driver17@taxikavala.gr',
//       phone: '6977889900',
//       password: 'DriverPass!117',
//       status: 'available',
//       location: { lat: 40.9415, lng: 24.4195 },
//       average_rating: 4.3,
//       ratingCount: 29, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-118',
//       firstName: 'Ευαγγελία',
//       lastName: 'Χατζή',
//       carNumber: 'ΚΒΦ-4680',
//       email: 'driver18@taxikavala.gr',
//       phone: '6988990011',
//       password: 'DriverPass!118',
//       status: 'available',
//       location: { lat: 40.9360, lng: 24.4070 },
//       average_rating: 4.8,
//       ratingCount: 17, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-119',
//       firstName: 'Μιχαήλ',
//       lastName: 'Παναγιώτου',
//       carNumber: 'ΚΒΨ-2460',
//       email: 'driver19@taxikavala.gr',
//       phone: '6999001122',
//       password: 'DriverPass!119',
//       status: 'offline',
//       location: { lat: 40.9345, lng: 24.4035 },
//       average_rating: 4.0,
//       ratingCount: 8, 
//       role: 'driver',
//     },
//     {
//       id: 'driver-120',
//       firstName: 'Ζωή',
//       lastName: 'Λάμπρου',
//       carNumber: 'ΚΒΩ-1359',
//       email: 'driver20@taxikavala.gr',
//       phone: '6900112233',
//       password: 'DriverPass!120',
//       status: 'available',
//       location: { lat: 40.9385, lng: 24.4125 },
//       average_rating: 4.9,
//       ratingCount: 42, 
//       role: 'driver',
//     },
//   ];
  
//   const reviews = [
//     // driver-101
//     { id: 'rev_101', driverId: 'driver-101', rating: 5, comment: 'Άψογος!', customerName: 'Κώστας', createdAt: '2025-08-01T10:15:00Z' },
//     { id: 'rev_102', driverId: 'driver-101', rating: 4, comment: 'Γρήγορος και ευγενικός.', customerName: 'Ελένη', createdAt: '2025-07-25T08:00:00Z' },
//     { id: 'rev_103', driverId: 'driver-101', rating: 5, comment: 'Πεντακάθαρο αυτοκίνητο.', customerName: 'Νίκος', createdAt: '2025-07-18T20:30:00Z' },
//     { id: 'rev_104', driverId: 'driver-101', rating: 3, comment: 'Καλή διαδρομή, λίγο αργός.', customerName: 'Άννα', createdAt: '2025-07-10T12:10:00Z' },
//     { id: 'rev_105', driverId: 'driver-101', rating: 4, comment: 'Όλα καλά.', customerName: 'Μάριος', createdAt: '2025-07-02T07:45:00Z' },
//     // driver-102
//     { id: 'rev_201', driverId: 'driver-102', rating: 5, comment: 'Εξαιρετική!', customerName: 'Γιάννης', createdAt: '2025-08-02T09:00:00Z' },
//     { id: 'rev_202', driverId: 'driver-102', rating: 5, comment: 'Η καλύτερη εμπειρία.', customerName: 'Χρύσα', createdAt: '2025-07-20T14:25:00Z' }
//   ];

//   const requests = [
//     { id: 'req_1001', driverId: 'driver-101', changes: { firstName: 'Γιώργος', lastName: 'Νεότατος', phone: '6990000000' }, status: 'pending', createdAt: '2025-08-10T12:00:00Z' },,
//     { id: 'req_1002', driverId: 'driver-102', changes: { email: 'maria.new@example.com', carNumber: 'ΚΒΓ-9999' }, status: 'pending', createdAt: '2025-08-11T09:30:00Z' }
//   ];
  
//   const adminMessages = [
//     {
//       id: 'msg_1',
//       content: 'Μην ξεχάσετε να ελέγξετε τα προσωπικά σας στοιχεία.',
//       createdAt: '2025-08-12T08:00:00Z'
//     },
//     {
//       id: 'msg_2',
//       content: 'Σας ευχαριστούμε που συμμετέχετε στην πλατφόρμα μας!',
//       createdAt: '2025-08-10T09:30:00Z'
//     }
//   ];

//   const problems = [
//     {
//       id: 'prob_1001',
//       driverId: 'driver-101',
//       title: 'Καθυστέρηση παραλαβής',
//       category: 'delay',
//       description: 'Ο πελάτης ανέφερε 20 λεπτά καθυστέρηση.',
//       status: 'open',
//       createdAt: '2025-08-05T11:00:00Z'
//     },
//     {
//       id: 'prob_1002',
//       driverId: 'driver-101',
//       title: 'Θόρυβος οχήματος',
//       category: 'vehicle',
//       description: 'Παράπονο για ενοχλητικό θόρυβο στο όχημα.',
//       status: 'open',
//       createdAt: '2025-08-06T08:30:00Z'
//     },
//     {
//       id: 'prob_2001',
//       driverId: 'driver-102',
//       title: 'Άκυρη χρέωση',
//       category: 'billing',
//       description: 'Χρέωση μεγαλύτερη από την εφαρμογή.',
//       status: 'open',
//       createdAt: '2025-07-01T09:00:00Z'
//     }
//   ];

//   const rides = [
//     // Για driver-101
//     {
//       id: 'ride_101_1',
//       driverId: 'driver-101',
//       status: 'success',
//       createdAt: '2025-08-10T10:00:00Z'
//     },
//     {
//       id: 'ride_101_2',
//       driverId: 'driver-101',
//       status: 'success',
//       createdAt: '2025-07-22T14:30:00Z'
//     },
//     {
//       id: 'ride_101_3',
//       driverId: 'driver-101',
//       status: 'problem',
//       createdAt: '2025-07-05T09:15:00Z'
//     },
//     {
//       id: 'ride_101_4',
//       driverId: 'driver-101',
//       status: 'failed',
//       createdAt: '2025-06-17T18:45:00Z'
//     },
//     {
//       id: 'ride_101_5',
//       driverId: 'driver-101',
//       status: 'success',
//       createdAt: '2025-05-08T12:10:00Z'
//     },
  
//     // Για driver-102
//     {
//       id: 'ride_102_1',
//       driverId: 'driver-102',
//       status: 'success',
//       createdAt: '2025-08-11T11:00:00Z'
//     },
//     {
//       id: 'ride_102_2',
//       driverId: 'driver-102',
//       status: 'problem',
//       createdAt: '2025-07-29T13:50:00Z'
//     },
//     {
//       id: 'ride_102_3',
//       driverId: 'driver-102',
//       status: 'success',
//       createdAt: '2025-06-20T17:00:00Z'
//     },
//     {
//       id: 'ride_102_4',
//       driverId: 'driver-102',
//       status: 'failed',
//       createdAt: '2025-05-12T20:30:00Z'
//     },
//     {
//       id: 'ride_102_5',
//       driverId: 'driver-102',
//       status: 'success',
//       createdAt: '2025-04-01T07:45:00Z'
//     }
//   ];

//   const mockRideRequests = [
//     {
//       id: 'mock_ride_001',
//       assignedDriverId: 'driver-101',
//       status: 'awaiting_response',
//       notifiedAt: '2025-08-13T12:00:00Z',
//       location: { lat: 40.937, lng: 24.410 },
//       firstName: 'Γιάννης',
//       lastName: 'Παπαδόπουλος',
//       phone: '6999999999',
//       address: 'Οδός Ελευθερίας 45, Καβάλα'
//     },
//     {
//       id: 'mock_ride_002',
//       assignedDriverId: 'driver-102',
//       status: 'awaiting_response',
//       notifiedAt: '2025-08-13T12:10:00Z',
//       location: { lat: 40.939, lng: 24.412 },
//       firstName: 'Μαρία',
//       lastName: 'Αναγνωστοπούλου',
//       phone: '6988888888',
//       address: 'Οδός Φαλήρου 23, Καβάλα'
//     },
//     {
//       id: 'mock_ride_003',
//       assignedDriverId: 'driver-103',
//       status: 'awaiting_response',
//       notifiedAt: '2025-08-13T12:20:00Z',
//       location: { lat: 40.935, lng: 24.408 },
//       firstName: 'Δημήτρης',
//       lastName: 'Καλογερόπουλος',
//       phone: '6977777777',
//       address: 'Λεωφόρος Δημοκρατίας 100, Καβάλα'
//     },
//     {
//       id: 'mock_ride_004',
//       assignedDriverId: 'driver-104',
//       status: 'awaiting_response',
//       notifiedAt: '2025-08-13T12:30:00Z',
//       location: { lat: 40.931, lng: 24.403 },
//       firstName: 'Ελένη',
//       lastName: 'Σταματοπούλου',
//       phone: '6966666666',
//       address: 'Οδός Ομονοίας 12, Καβάλα'
//     }
//   ];

//   const users = [
//     {
//       id: 'user-201',
//       firstName: 'Πέτρος',
//       lastName: 'Κωνσταντίνου',
//       email: 'user@taxikavala.gr',
//       phone: '6991234567',
//       password: 'UserPass!123',
//       role: 'user'
//     },
//     {
//       id: 'user-202',
//       firstName: 'Μαρία',
//       lastName: 'Στεργίου',
//       email: 'maria@example.com',
//       phone: '6911111111',
//       password: 'UserPass!456',
//       role: 'user'
//     }
//   ];
  
  
//   module.exports = { admins, drivers, rides, reviews, adminMessages, requests, problems, mockRideRequests,
//     users };
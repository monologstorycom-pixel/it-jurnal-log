<?php
// Konfigurasi koneksi ke Asterisk
$host = "127.0.0.1";
$user = "admin-rsby";
$pass = "password-noc-kamu";

// Buka koneksi socket
$socket = fsockopen($host, "5038", $errno, $errstr, 10);
if (!$socket) {
    die("Gagal konek ke Asterisk: $errstr ($errno)");
}

// Login ke Manager
fputs($socket, "Action: Login\r\n");
fputs($socket, "UserName: $user\r\n");
fputs($socket, "Secret: $pass\r\n\r\n");

// Kirim perintah Command untuk cek status peer
fputs($socket, "Action: Command\r\n");
fputs($socket, "Command: sip show peers\r\n\r\n");

// Baca responnya
$status_data = "";
while (!feof($socket)) {
    $line = fgets($socket, 1024);
    if (trim($line) == "--END COMMAND--") break;
    $status_data .= $line;
}

// Logout
fputs($socket, "Action: Logoff\r\n\r\n");
fclose($socket);

// Tampilkan dengan gaya Frontend Developer
echo "<html><body style='background:#1e1e1e; color:#00ff00; font-family:monospace; padding:20px;'>";
echo "<h2>[RSBY NOC - LIVE STATUS]</h2>";
echo "<pre>" . htmlspecialchars($status_data) . "</pre>";
echo "</body></html>";
?>
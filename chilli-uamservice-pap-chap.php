<?php

/*
 * Sample api call from chillipepper
 * https://app.paywifigo.me/chilli-uamservice-pap-chap.php?null?timeout=5000&prefix=__Pepper&callback=__Pepper
 */

# Shared secret used to encrypt challenge with. Prevents dictionary attacks.
# You should change this to your own shared secret.
$uamsecret = "radpass";
//$password = 'testdev';
/*
 * set HS_UAMSECRET=chilliradiusSecret            = In /etc/chilli/defaults  or /etc/chilli/config
*        UAM SERVICE should reply with a JSON response containing
*           - CHAP logon : CHAP-Password X0Red with UAM SECRET
*           - PAP  logon : Password XORed with UAM SECRET
*/


if ((isset($_GET['password']) && isset($_GET['challenge'])) || (isset($_POST['password']) && isset($_POST['challenge']))) {
    $challenge = $_GET['challenge'] ?? $_POST['challenge'];
    $password = $_GET['password'] ?? $_POST['password'];

    $hexchal = pack("H32", $challenge);

//CHAP-Password & PAP-Password X0Red with UAM SECRET
    $newchal = pack("H*", md5($hexchal . $uamsecret));

// CHAP-Password - Generated from XORED packed Chilli-Challenge
    $response = md5("\0" . $password . $newchal);


//- PAP  logon : Password XORed with UAM SECRET
    $newpwd = pack("a32", $password);
    $pappassword = implode("", unpack("H32", ($newpwd ^ $newchal)));
    header('application/json');
    $array = ['pap' => $pappassword, 'chap' => $response];
    $json_data = json_encode($array);
    if (isset($_GET['callback'])) {
        $callback = $_GET['callback'];
        echo "$callback($json_data)";
    } else {
        echo $json_data;
    }

}

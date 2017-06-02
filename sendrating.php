<?php

$request = new HttpRequest();
$request->setUrl('https://digibid.azurewebsites.net/action.ashx');
$request->setMethod(HTTP_METH_POST);


$request->setQueryData(array(
  'action' => 'json'
));

$request->setHeaders(array(
  'cache-control' => 'no-cache',
  'content-type' => 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
));

if (isset($_POST['star'])) {
	echo func1($_POST['star']);
}
if (isset($_POST['comment'])) {
	echo func1($_POST['comment']);
}

$request->setBody('------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="data"

{"command": "update_chat_log","auth_key": "a6hea2","chat_id": "rating",
"dialog_id":"rating","dialog_state":"1","dialog_type":"text","dialog_input":"' + $_POST['star'] + '","chat_log": "' + $_POST['comment'] + '"}
------WebKitFormBoundary7MA4YWxkTrZu0gW--');

try {
  $response = $request->send();

  echo $response->getBody();
} catch (HttpException $ex) {
  echo $ex;
}
?>
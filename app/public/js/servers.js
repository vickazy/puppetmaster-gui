/* eslint-disable no-undef */

$(document).ready(function () {
  var create_aws_environment_button = document.getElementById('create_aws_environment_button')
  var save_environment_button = document.getElementById('save_environment_button')
  var export_environment_button = document.getElementById('export_environment_button')
  var next_server_button = document.getElementById('next_server_button')
  if (create_aws_environment_button) {
    create_aws_environment_button.addEventListener('click', function () {
      createAWSEnvironment()
    }, false)
  }
  if (save_environment_button) {
    save_environment_button.addEventListener('click', function () {
      saveData(function (){})
    }, false)
  }

  if (export_environment_button) {
    export_environment_button.addEventListener('click', function () {
      {window.location.href = '/servers/export'}
    }, false)
  }

  if (next_server_button) {
    next_server_button.addEventListener('click', function () {
      saveData(function (){window.location.href = '/puppet-config'})
    }, false)
  }
  if (window.location.href.includes('servers')) {
    updateProvisioningStatus()
    updateTimer = window.setInterval(updateProvisioningStatus, 2000)
  }
})

var updateTimer

function createAWSEnvironment () {
  // Save AWS information

  var privateKey
  if(typeof $('#privateKey').val() != 'undefined') {
    privateKey = $('#privateKey').val().replace(/\.[^/.]+$/, "")
  } else {
    privateKey = $('#privateKeySaved').html()
  }
  var awsConfig = {
    'aws_key': $('#aws_key').val(),
    'aws_secret': $('#aws_secret').val(),
    'aws_region': $('#regionSelect').val(),
    'vpc_id': $('#vpc_id').val(),
    'private_key' : privateKey
  }

  if(typeof $('#upload_form').val() != 'undefined') {
    $('#upload_form').ajaxSubmit({
      error: function(xhr) {
        console.log('Error: ' + xhr.status);
      },

      success: function(response) {
        console.log(response)
      }
    });
  }

  $.post('/servers/aws', {awsData: JSON.stringify(awsConfig)}, function () {
    $.post('/servers/schedule', {}, function () {
      $('#create_aws_environment_button').hide()
      $('#environment-loading').show()
    })
  })


}


function updateProvisioningStatus () {
  String.prototype.contains = function(it) { return this.indexOf(it) != -1; };
  var numberOfTasks = 0;
  var completedTasks = 0;
  $.get('/servers/tasks/ec2', function (taskData) {

    for (var i = 0; i < taskData.length; i++) {
      var taskName = taskData[i].task_id
      var currentNode = 0;
      // Match the task with the server in environmentModel
      for (var e = 0; e < environmentModel.servers().length; e++) {
        for (var m = 0; m < environmentModel.servers()[e].members().length; m++) {
          status = ''
          if (taskName.contains(environmentModel.servers()[e].members()[m].name())) {
            numberOfTasks++;
            (function (taskData, e, m, i) {
              var runId = taskData[i].run_id

              $.get('/restate-machines/' + runId, function (data) {
                // Find a slot in nodes array
                for (var nodeId = 0; nodeId < environmentModel.servers()[e].members()[m].node_count(); nodeId++) {
                  if(typeof environmentModel.servers()[e].members()[m].nodes()[nodeId].run_id != 'undefined') {
                    if(environmentModel.servers()[e].members()[m].nodes()[nodeId].run_id == runId) {
                      currentNode = nodeId;
                    }
                  } else {
                    environmentModel.servers()[e].members()[m].nodes()[nodeId].run_id = runId
                    currentNode = nodeId
                  }
                }
                var result = data
                var status = JSON.parse(result.StatusMessage)
                if(status.status === 'failed') {
                  $("#pre-flight-failed").show()
                }
                if(status.status === 'done') {
                  completedTasks++;
                  var hostname = JSON.parse(result.Input).public_dns
                  var password = JSON.parse(result.Input).password
                  environmentModel.servers()[e].members()[m].nodes()[currentNode].hostname(hostname)
                  if (typeof environmentModel.servers()[e].members()[m].nodes()[currentNode].password == 'function')
                  {
                    environmentModel.servers()[e].members()[m].nodes()[currentNode].password(password)
                  }
                  if(completedTasks == numberOfTasks) {
                    $('#environment-loading').hide()
                    $('#provisioning-complete').show()
                    $('#create_aws_environment_button').hide()
                    window.clearInterval(updateTimer)
                  }
                }
                environmentModel.servers()[e].members()[m].nodes()[currentNode].provisioning_status.message(status.message)
                environmentModel.servers()[e].members()[m].nodes()[currentNode].provisioning_status.status(status.status)
              })
            })(taskData, e, m, i)
          }
        }
      }
    }
  })
}


function saveData (callback) {
  var dataToSave = JSON.parse(ko.toJSON(environmentModel))
  delete dataToSave.__ko_mapping__
  $.ajax({
    url: '/platform-options',
    type: 'PUT',
    success: function () {
      callback()
    },
    data: { name: environmentName, platformData: JSON.stringify(dataToSave)}
  })
}

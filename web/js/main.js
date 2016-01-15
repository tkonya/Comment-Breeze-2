var commentApp = angular.module('commentApp', ['angular-clipboard', 'ngMaterial'])
    .config(function($mdThemingProvider) {
        $mdThemingProvider.theme('default')
            .primaryPalette('amber')
            .accentPalette('deep-purple')
            .backgroundPalette('grey').dark();

        $mdThemingProvider.theme('default').foregroundPalette[3] = '#A9B7C6';
    });

commentApp.controller('CommentController', function($scope, $http, $mdToast, $mdDialog, $mdMedia, $document, $location, $timeout) {

    // comments
    $scope.comments = [];
    $scope.allComments = []; // when 'filtering', put all comments in here, then we'll pull them back out when we switch back
    $scope.editingComment = {};
    $scope.editingPasswordTry = '';
    $scope.commentSizeToGet = 0; // 0 should indicate that we intend to get them all or have gotten them all
    $scope.totalCommentsSize = '20000';
    $scope.commonTags = [];

    // pagination
    $scope.commentViewLimit = 20;
    $scope.commentViewBegin = 0;
    $scope.currentCommentsPage = 1;
    $scope.totalCommentPages = null;

    // single student
    $scope.studentName = '';
    $scope.oldStudentName = null;
    $scope.className = '';
    $scope.oldClassName = null;

    // single student search and filter
    $scope.searchComments = '';
    $scope.toneFilterSetting = 'Any';
    $scope.toneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative', 'Unrated', 'Flagged'];

    // multi student
    $scope.newMultiStudent = '';
    $scope.multiStudent = [];
    $scope.editingMultiStudent = null;
    $scope.allMultiStudentComments = ''; // this must be updated any time it changes for the copy to work right, it has to already be correct by the time copy is hit
    $scope.useSmartSearch = false;

    // both single and multi
    $scope.yourCommentIntroduction = '';
    $scope.yourComment = '';
    $scope.yourCommentConclusion = '';
    $scope.gender = 'male';

    // smart search
    $scope.smartSearch = [];
    $scope.newSmartSearch = {search_text: '', found_comment: '', tone: 'Any', tags: false, text: false};
    $scope.limitedToneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative'];

    // settings
    $scope.showTooltips = true;
    $scope.showHints = false;
    $scope.showTone = true;
    $scope.showTags = true;
    $scope.showEditButtons = true;
    $scope.makeSomethingUpSize = 10;
    $scope.avoidHer = true;
    $scope.enableNeutralGender = false;
    $scope.reduceCommentsSize = 10000;
    $scope.showCommonTags = false;

    // navigation
    $scope.selectedTab = 0;

    $scope.getComments = function(showAllLoadedMessage) {

        var commentsToGet = $scope.commentSizeToGet;

        // see if we got a limit in the url params
        var params = $location.search();
        if (params.limit != null) {
            commentsToGet = params.limit;
            if (commentsToGet == 0) {
                $scope.illToastToThat('Reloaded all comments');
            }
        }

        $location.search('limit', null);

        $http.get('/rest/comments?size=' + commentsToGet).
            success(function (data) {
                console.log('returned success');
                console.log(data.comments.length + ' comments received');

                $scope.comments = data.comments;
                $scope.totalCommentsSize = data.total_size;
                $scope.commonTags = data.common_tags;

                if ($scope.selectedTab == 4 && $scope.comments.length < $scope.totalCommentsSize) {
                    $scope.illToastToThat('Reloaded with ' + $scope.formatNumber($scope.comments.length) + ' comments');
                } else {
                    if (!data.all_comments_loaded) {
                        $timeout(function() {
                            $scope.illToastToThat($scope.formatNumber($scope.comments.length) + ' comments loaded - see settings tab to change');
                        }, 150);
                    } else if (showAllLoadedMessage) {
                        $scope.illToastToThat('Full comment set loaded');
                    }
                }

                $scope.changeCommentsPerPage();

            }).
            error(function () {
                $scope.illToastToThat('Error loading comments');
            });
    };

    $scope.addComment = function(comment, showToast) {

        console.log('Adding comment: ' + comment);

        $scope.oldStudentName = $scope.studentName;

        comment = $scope.capitalizeFirstLetter($scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName(comment))));

        if ($scope.yourComment == '') {
            $scope.yourComment = comment;
        } else {
            $scope.yourComment = $scope.yourComment + ' ' + comment;
        }

        if (showToast) {
            $scope.illToastToThat('Comment added');
        }
    };

    $scope.fixCommentPronouns = function() {
        // I'm not sure why I did this in a timeout initially, maybe it's not necessary anymore?
        //$timeout(function() {
        //    $scope.yourCommentIntroduction = $scope.fixGenderPronouns($scope.yourCommentIntroduction);
        //    $scope.yourComment = $scope.fixGenderPronouns($scope.yourComment);
        //    $scope.yourCommentConclusion = $scope.fixGenderPronouns($scope.yourCommentConclusion);
        //
        //    $scope.illToastToThat('Gender pronouns changed to ' + $scope.gender);
        //
        //}, 50);

        $scope.yourCommentIntroduction = $scope.fixGenderPronouns($scope.yourCommentIntroduction);
        $scope.yourComment = $scope.fixGenderPronouns($scope.yourComment);
        $scope.yourCommentConclusion = $scope.fixGenderPronouns($scope.yourCommentConclusion);

        $scope.illToastToThat('Gender pronouns changed to ' + $scope.gender);
    };

    $scope.fixGenderPronouns = function(text, gender) {

        if (gender == undefined) {
            gender = $scope.gender;
            console.log('using single student gender of ' + $scope.gender);
        }

        var subject;
        var object;
        var possessiveAdjectives;
        var possessivePronouns;
        var reflexivePronouns;
        var girlBoyChild;

        console.log('Changing gender to ' + gender + ' for the text:\n' + text);
        if (gender == 'male') {
            subject = 'he';
            object = 'him';
            possessiveAdjectives = 'his';
            possessivePronouns = 'his';
            reflexivePronouns = 'himself';
            girlBoyChild = 'boy';
        } else if (gender == 'female') {
            subject = 'she';
            object = 'her';
            possessiveAdjectives = 'her';
            possessivePronouns = 'hers';
            reflexivePronouns = 'herself ';
            girlBoyChild = 'girl';
        } else {
            subject = 'they';
            object = 'them';
            possessiveAdjectives = 'their';
            possessivePronouns = 'theirs';
            reflexivePronouns = 'themselves';
            girlBoyChild = 'child';
        }

        text = text.replace(/\bboy\b|\bgirl\b|\bchild\b/g,girlBoyChild).replace(/\bBoy\b|\bGirl\b|\bChild\b/g,$scope.capitalizeFirstLetter(girlBoyChild));
        text = text.replace(/\bhe\b|\bshe\b|\bthey\b/g,subject).replace(/\bhis\b|\bhers\b|\btheirs\b/g,possessivePronouns).replace(/\bhim\b|\bher\b|\bthem\b/g,object).replace(/\bhis\b|\bher\b|\btheir\b/g,possessiveAdjectives).replace(/\bhimself\b|\bherself\b|\btheirself\b/g,reflexivePronouns);
        text = text.replace(/\bHe\b|\bShe\b|\bThey\b/g,$scope.capitalizeFirstLetter(subject)).replace(/\bHim\b|\bHer\b|\bThem\b/g,$scope.capitalizeFirstLetter(object)).replace(/\bHis\b|\bHers\b|\bTheirs\b/g,$scope.capitalizeFirstLetter(possessivePronouns)).replace(/\bHis\b|\bHer\b|\bTheir\b/g,$scope.capitalizeFirstLetter(possessiveAdjectives)).replace(/\bHimself\b|\bHerself\b|\bTheirself\b/g,$scope.capitalizeFirstLetter(reflexivePronouns));
        console.log('Fixed text: ' + text);
        return text;
    };

    $scope.changeStudentName = function() {
        console.log('student name: ' + $scope.studentName);
        console.log('old student name: ' + $scope.oldStudentName);

        if ($scope.studentName == null || $scope.studentName == '' || $scope.studentName == $scope.oldStudentName) {
            return;
        }

        $scope.yourCommentIntroduction = $scope.replaceStudentName($scope.yourCommentIntroduction, true);
        $scope.yourComment = $scope.replaceStudentName($scope.yourComment, true);
        $scope.yourCommentConclusion = $scope.replaceStudentName($scope.yourCommentConclusion);

        $scope.illToastToThat('Student name changed to ' + $scope.studentName);
    };

    $scope.changeClassName = function() {
        console.log('class name: ' + $scope.className);
        console.log('old class name: ' + $scope.oldClassName);

        if ($scope.className == null || $scope.className == '' || $scope.className == $scope.oldClassName) {
            return;
        }

        $scope.yourCommentIntroduction = $scope.replaceClassName($scope.yourCommentIntroduction, true);
        $scope.yourComment = $scope.replaceClassName($scope.yourComment, true);

        // replace it in all of the multi student texts too
        if ($scope.multiStudent.length > 0) {
            for (var i = 0; i < $scope.multiStudent.length; ++i) {
                $scope.multiStudent[i].comment = $scope.replaceClassName($scope.multiStudent[i].comment, true);
            }
            $scope.buildAllMultiStudentComments();
        }


        $scope.yourCommentConclusion = $scope.replaceClassName($scope.yourCommentConclusion);

        $scope.illToastToThat('Class name changed to ' + $scope.className);
    };

    $scope.replaceStudentName = function(text, dontSet) {
        var studentName;
        if ($scope.studentName == null || $scope.studentName == '') {
            studentName = 'STUDENT_NAME';
        } else {
            studentName = $scope.studentName;
        }

        if ($scope.oldStudentName != null && $scope.oldStudentName.length > 0) {
            text = text.replace(new RegExp($scope.oldStudentName, 'g'), studentName);
        }

        if (!dontSet) {
            $scope.oldStudentName = studentName;
        }

        return text.replace(/STUDENT_NAME/g, studentName);
    };

    $scope.replaceMultiStudentName = function(text, studentName, oldStudentName) {
        if (studentName != null && studentName != '') {
            if (oldStudentName != null) {
                text = text.replace(new RegExp($scope.oldStudentName, 'g'), studentName);
            }
            return text.replace(/STUDENT_NAME/g, studentName);
        }
        return text;
    };

    $scope.replaceClassName = function(text, dontSet) {
        var className;
        if ($scope.className == null || $scope.className == '') {
            className = 'CLASS_NAME';
        } else {
            className = $scope.className;
        }

        if ($scope.oldClassName != null && $scope.oldClassName.length > 0) {
            text = text.replace(new RegExp($scope.oldClassName, 'g'), className);
        }

        if (!dontSet) {
            $scope.oldClassName = className;
        }

        return text.replace(/CLASS_NAME/g, className);
    };

    $scope.capitalizeFirstLetter = function(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    $scope.changeCommentsPerPage = function() {
        console.log('Changing comment limit to ' + $scope.commentViewLimit);
        $scope.currentCommentsPage = 1;
        $scope.totalCommentPages = Math.ceil($scope.comments.length / $scope.commentViewLimit);
        $scope.commentViewBegin = 0;
    };

    $scope.changeCommentsPage = function(newPage) {
        if ($scope.currentCommentsPage != newPage) {
            console.log('Changing page to ' + newPage);
            if (newPage >= 1 && newPage <= $scope.totalCommentPages) {
                $scope.currentCommentsPage = newPage;
                $scope.commentViewBegin = ($scope.currentCommentsPage - 1) * $scope.commentViewLimit;
            }
        }
    };

    $scope.shuffleSingleStudentComment = function() {
        $scope.yourComment = $scope.shuffleText($scope.yourComment);
    };

    $scope.showEditCommentDialog = function(comment) {

        $scope.editingComment = angular.copy(comment);

        console.log('editing comment: ' + $scope.editingComment);
        if (!$scope.editingComment.hasOwnProperty('tags')) {
            $scope.editingComment.tags = [];
        } else {
            console.log('copying old tags');
            $scope.editingComment.old_tags = angular.copy($scope.editingComment.tags); // copy the old ones so we know which ones are deleted later
        }

        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/edit-comment-dialog.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
                $scope.saveDialog = function() {

                    console.log('in saveDialog');
                    $mdDialog.hide();
                    $http({
                        url: "/rest/comments",
                        method: "PUT",
                        params: {comment: $scope.editingComment, editing_password_try: $scope.editingPasswordTry},
                        headers: {'Content-Type': 'application/json'}
                    }).success(function (data) {

                        // if we didn't actually add tags then take out the tag array
                        if ($scope.editingComment.hasOwnProperty('tags') && $scope.editingComment.tags.length == 0) {
                            delete $scope.editingComment.tags;
                        }

                        $scope.findAndUpdateComment($scope.editingComment);

                        if (data.hasOwnProperty('passfail')) {
                            $scope.editingPasswordTry = '';
                        }

                        $scope.illToastToThat(data.message);

                    }).error(function () {
                        $scope.illToastToThat('Error updating comment');
                    });
                };
            }
        });
    };

    // looks for a comment in the comments list with the same id and replaces it with the one passed in
    $scope.findAndUpdateComment = function(newComment) {
        for (var i = 0; i < $scope.comments.length; ++i) {
            if ($scope.comments[i].comment_id == newComment.comment_id) {

                if (newComment.hasOwnProperty('deleted') && (newComment.deleted == 1 || newComment.deleted == '1')) {
                    $scope.comments.splice(i, 1);
                } else {
                    $scope.comments.splice(i, 1, newComment);
                }

                break;
            }
        }
    };

    $scope.showEditToneDialog = function(comment) {
        $scope.editingComment = comment;
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/edit-tone-dialog.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
                $scope.setCommentTone = function(tone) {

                    $scope.editingComment.pos_neg = tone;

                    console.log('in saveDialog');
                    $mdDialog.hide();
                    $http({
                        url: "/rest/comments",
                        method: "PUT",
                        params: {comment: $scope.editingComment, editing_password_try: $scope.editingPasswordTry},
                        headers: {'Content-Type': 'application/json'}
                    }).success(function (data) {

                        if (data.hasOwnProperty('passfail')) {
                            $scope.editingPasswordTry = '';
                        }

                        $scope.illToastToThat(data.message);

                    }).error(function () {
                        $scope.illToastToThat('Error updating comment');
                    });
                };
            }
        });
    };

    $scope.showTagEditDialog = function(comment) {

        $scope.editingComment = angular.copy(comment);

        console.log('editing comment: ' + $scope.editingComment);
        if (!$scope.editingComment.hasOwnProperty('tags')) {
            $scope.editingComment.tags = [];
        } else {
            console.log('copying old tags');
            $scope.editingComment.old_tags = angular.copy($scope.editingComment.tags); // copy the old ones so we know which ones are deleted later
        }

        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/edit-tag-dialog.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
                $scope.saveDialog = function(tone) {

                    $scope.editingComment.pos_neg = tone;

                    console.log('in saveDialog');
                    $mdDialog.hide();
                    $http({
                        url: "/rest/comments",
                        method: "PUT",
                        params: {comment: $scope.editingComment, editing_password_try: $scope.editingPasswordTry},
                        headers: {'Content-Type': 'application/json'}
                    }).success(function (data) {

                        // if we didn't actually add tags then take out the tag array
                        if ($scope.editingComment.hasOwnProperty('tags') && $scope.editingComment.tags.length == 0) {
                            delete $scope.editingComment.tags;
                        }

                        $scope.findAndUpdateComment($scope.editingComment);

                        if (data.hasOwnProperty('passfail')) {
                            $scope.editingPasswordTry = '';
                        }

                        $scope.illToastToThat(data.message);

                    }).error(function () {
                        $scope.illToastToThat('Error updating comment');
                    });
                };
            }
        });
    };

    $scope.showSingleStudentHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/single-student-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showMultiStudentHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/multi-student-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showSmartSearchHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/smart-search-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.changeFilter = function() {
        console.log('changing the filter to ' + $scope.toneFilterSetting);
        //$scope.commentsLoaded = false;

        if ($scope.toneFilterSetting == 'Any') {

            // put the comments back in
            if ($scope.allComments.length > 0) {
                $scope.comments = $scope.allComments;
            }

        } else {

            // backup comments if you haven't already
            if ($scope.allComments < 1) {
                $scope.allComments = $scope.comments;
            }

            $scope.comments = [];
            for (var i = 0; i < $scope.allComments.length; ++i) {

                if ($scope.allComments[i].hasOwnProperty('pos_neg')) {
                    if (($scope.allComments[i].pos_neg == 1 && $scope.toneFilterSetting == 'Positive') ||
                        ($scope.allComments[i].pos_neg == 0 && $scope.toneFilterSetting == 'Neutral') ||
                        ($scope.allComments[i].pos_neg == -1 && $scope.toneFilterSetting == 'Negative')) {
                        $scope.comments.push($scope.allComments[i]);
                    }
                } else if ($scope.toneFilterSetting == 'Unrated') {
                    $scope.comments.push($scope.allComments[i]);
                } else if ($scope.toneFilterSetting == 'Flagged' && ($scope.allComments[i].flagged == 1 || $scope.allComments[i].flagged == '1' || $scope.allComments[i].flagged == 'true')) {
                    $scope.comments.push($scope.allComments[i]);
                }
            }
        }

        //$scope.commentsLoaded = true;
        $scope.changeCommentsPerPage();
        console.log('done changing filter');
    };

    $scope.illToastToThat = function(text) {
        console.log('Toast: ' + text);
        $mdToast.show(
            {
                template: '<md-toast class="toast-style">' + text + '</md-toast>',
                position: 'bottom right',
                parent: $document[0].querySelector('#toastBounds')
            }
        );
    };

    $scope.addMultiStudent = function() {

        if ($scope.newMultiStudent == null || $scope.newMultiStudent == '') {
            return;
        }

        var student = {};

        if ($scope.newMultiStudent.endsWith(' m') || $scope.newMultiStudent.endsWith(' M')) {
            student.gender = "male";
            student.name = $scope.newMultiStudent.replace(' m', '').replace(' M', '');
            console.log('detected male');
        } else if ($scope.newMultiStudent.endsWith(' f') || $scope.newMultiStudent.endsWith(' F')) {
            student.gender = "female";
            student.name = $scope.newMultiStudent.replace(' f', '').replace(' F', '');
        } else if ($scope.enableNeutralGender && ($scope.newMultiStudent.endsWith(' n') || $scope.newMultiStudent.endsWith(' N'))) {
            student.gender = "neutral";
            student.name = $scope.newMultiStudent.replace(' n', '').replace(' N', '');
        } else {
            student.name = $scope.newMultiStudent;
            student.gender = $scope.gender;
            console.log('Setting to default gender of ' + $scope.gender);
        }
        student.old_name = student.name;

        if ($scope.useSmartSearch && $scope.smartSearch.length > 0) {
            student.comment = '';
            for (var i = 0; i < $scope.smartSearch.length; ++i) {
                student.comment += $scope.capitalizeFirstLetter($scope.getSmartSearchResult($scope.smartSearch[i]).found_comment + ' ');
            }
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName(student.comment, student.name, student.old_name), true), student.gender);
        } else {
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName($scope.getRandomComments(), student.name, student.old_name), true), student.gender);
        }


        $scope.multiStudent.push(student);
        $scope.newMultiStudent = '';

        $scope.illToastToThat('Added student: ' + student.name + ' (' + student.gender + ')');

        $scope.buildAllMultiStudentComments();
    };

    $scope.regenerateMultiStudentComment = function(student) {

        if ($scope.useSmartSearch) {
            student.comment = '';
            for (var i = 0; i < $scope.smartSearch.length; ++i) {
                student.comment += $scope.capitalizeFirstLetter($scope.getSmartSearchResult($scope.smartSearch[i]).found_comment + ' ');
            }
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName(student.comment, student.name, student.old_name), true), student.gender);
        } else {
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName($scope.getRandomComments(), student.name, student.old_name), true), student.gender);
        }

        $scope.buildAllMultiStudentComments();
    };

    $scope.makeSomethingUp = function() {
        $scope.yourComment = '';
        $scope.addComment($scope.getRandomComments(), false);
        $scope.illToastToThat('Random comment generated');

    };

    $scope.getRandomComments = function(size) {
        var fullRandomComment = '';

        if (size == null) {
            size = $scope.makeSomethingUpSize;
        }

        for (var i = 0; i < size; ++i) {
            var randomComment = $scope.comments[Math.floor(Math.random() * $scope.comments.length)];

            if ($scope.avoidHer && $scope.gender != 'female' && (randomComment.comment_text.indexOf(' her ') > 0 || randomComment.comment_text.startsWith('Her') || randomComment.comment_text.endsWith(' her.'))) {
                --i;
                continue;
            }

            if (fullRandomComment == '') {
                fullRandomComment = $scope.capitalizeFirstLetter(randomComment.comment_text);
            } else {
                fullRandomComment = fullRandomComment + ' ' + $scope.capitalizeFirstLetter(randomComment.comment_text)
            }

        }

        return fullRandomComment;
    };


    $scope.removeMultiStudent = function(student) {
        var index = $scope.multiStudent.indexOf(student);
        if (index > -1) {
            $scope.multiStudent.splice(index, 1);
        }

        $scope.buildAllMultiStudentComments();
    };


    $scope.shuffleMultiStudentComment = function(student) {
        student.comment = $scope.shuffleText(student.comment);
        $scope.buildAllMultiStudentComments();
    };

    $scope.shuffleText = function(text) {
        var sentences = text.match( /[^\.!\?]+[\.!\?]+/g );
        console.log('Found ' + sentences.length + ' sentences');

        for(var j, x, i = sentences.length; i; j = Math.floor(Math.random() * i), x = sentences[--i], sentences[i] = sentences[j], sentences[j] = x) {}

        text = '';
        for (var k = 0; k < sentences.length; ++k) {
            if (text == '') {
                text = sentences[k].trim();
            } else {
                text = text + sentences[k].trim();
            }
        }

        return text;
    };

    $scope.shuffleCommentBank = function() {
        for(var j, x, i = $scope.comments.length; i; j = Math.floor(Math.random() * i), x = $scope.comments[--i], $scope.comments[i] = $scope.comments[j], $scope.comments[j] = x) {}
        $scope.illToastToThat('Comment bank shuffled');
    };

    $scope.buildAllMultiStudentComments = function() {
        $scope.allMultiStudentComments = '';
        for (var i = 0; i < $scope.multiStudent.length; ++i) {
            $scope.allMultiStudentComments += $scope.multiStudent[i].name + ':\n' +
                $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName($scope.yourCommentIntroduction, $scope.multiStudent[i].name, $scope.multiStudent[i].old_name), true), $scope.multiStudent[i].gender) + ' ' +
                $scope.multiStudent[i].comment + ' ' +
                $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceMultiStudentName($scope.yourCommentConclusion, $scope.multiStudent[i].name, $scope.multiStudent[i].old_name), true), $scope.multiStudent[i].gender) + '\n\n\n';

            $scope.allMultiStudentComments = $scope.allMultiStudentComments.replace(/  +/g, ' ');
        }
    };

    $scope.editMultiStudentComment = function(student, tab) {
        $scope.editingMultiStudent = student;
        $scope.studentName = student.name;
        $scope.oldStudentName = student.name;
        $scope.yourComment = student.comment;
        $scope.gender = student.gender;
        $scope.selectedTab = tab;
        if (tab == 1) {
            $scope.illToastToThat('Editing '+ student.name +' as single student.')
        } else if (tab == 3) {
            $scope.illToastToThat('Editing '+ student.name +' as smart search.')
        }
    };

    $scope.selectMultiStudentTab = function() {
        if ($scope.editingMultiStudent != null) {
            var index = $scope.multiStudent.indexOf($scope.editingMultiStudent);
            console.log('Index of editing student is ' + index);
            if (index > -1) {
                $scope.multiStudent[index].name = $scope.studentName;
                $scope.studentName = null;

                $scope.multiStudent[index].comment = $scope.yourComment;
                $scope.yourComment = null;

                $scope.multiStudent[index].gender = $scope.gender;
                $scope.gender = 'male';
            }
            $scope.editingMultiStudent = null;
        }
    };

    $scope.reloadWithLimit = function(limit) {
        if (limit != null) {
            $location.search('limit', limit);
        } else {
            $location.search('limit', $scope.reduceCommentsSize);
        }
        location.reload();
    };

    $scope.formatNumber = function(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    $scope.getSmartSearchResult = function(search) {

        search.found_comment = '';

        console.log('search text: ' + search.search_text);

        // we start looking at a random starting point so that we don't end up getting the same comments for every search
        var randomStartingPoint = Math.floor((Math.random() * $scope.comments.length));
        console.log('Starting at random index ' + randomStartingPoint);

        for (var i = randomStartingPoint; i < $scope.comments.length + randomStartingPoint; ++i) {

            var index = i;
            if (index >= $scope.comments.length) {
                index -= $scope.comments.length;
            }

            if ($scope.avoidHer && $scope.gender != 'female' && ($scope.comments[index].comment_text.indexOf(' her ') > 0 || $scope.comments[index].comment_text.startsWith('Her') || $scope.comments[index].comment_text.endsWith(' her.'))) {
                continue;
            }

            // yes I know I can make this statement more compact, but then it would be less readable
            if (search.tone != 'Any') {
                if (search.tone == 'Positive' && $scope.comments[index].pos_neg != 1) {
                    continue;
                } else if (search.tone == 'Neutral' && $scope.comments[index].pos_neg != 0) {
                    continue;
                } else if (search.tone == 'Negative' && $scope.comments[index].pos_neg != -1) {
                    continue;
                }
            }

            if (search.tags && search.text) {
                if ($scope.comments[index].comment_text.toLowerCase().indexOf(search.search_text) < 0 && (!$scope.comments[index].hasOwnProperty('tags') || $scope.comments[index].tags.indexOf(search.search_text) < 0)) {
                    continue;
                }
            } else if (search.tags) {
                if (!$scope.comments[index].hasOwnProperty('tags') || $scope.comments[i].tags.indexOf(search.search_text) < 0) {
                    continue;
                }
            } else if (search.text) {
                if ($scope.comments[index].comment_text.toLowerCase().indexOf(search.search_text) < 0) {
                    continue;
                }
            }

            console.log('Searched ' + i + ' comments');
            console.log('Found comment matching search: ' + $scope.comments[index].comment_text);
            search.found_comment = $scope.comments[index].comment_text;
            break;
        }

        if ($scope.selectedTab == 3 && $scope.smartSearch.length > 0) {
            $scope.useSmartSearch = true;
        }

        return angular.copy(search);
    };

    $scope.shuffleSmartSearch = function() {
        for(var j, x, i = $scope.smartSearch.length; i; j = Math.floor(Math.random() * i), x = $scope.smartSearch[--i], $scope.smartSearch[i] = $scope.smartSearch[j], $scope.smartSearch[j] = x) {}
        $scope.buildAllSmartSearchComments();
    };

    $scope.buildAllSmartSearchComments = function() {
        console.log('Building smart search comments');
        console.log('Have ' + $scope.smartSearch.length + ' smart search comments');
        $scope.yourComment = '';
        for (var i = 0; i < $scope.smartSearch.length; ++i) {
            $scope.yourComment += $scope.capitalizeFirstLetter($scope.replaceClassName($scope.replaceMultiStudentName($scope.smartSearch[i].found_comment, $scope.studentName, $scope.oldStudentName), true), $scope.gender) + ' ';
        }
    };

    $scope.justMakeSomethingUpSmartSearch = function() {
        $scope.smartSearch = [];
        for (var i = 0; i < $scope.makeSomethingUpSize; ++i) {
            $scope.smartSearch.push($scope.getSmartSearchResult($scope.newSmartSearch));
        }
        $scope.buildAllSmartSearchComments();
    };

    $scope.regenerateAllSmartSearch = function() {
        console.log('Regenerating ' + $scope.smartSearch.length + ' searches');
        for (var i = 0; i < $scope.smartSearch.length; ++i) {
            $scope.smartSearch.splice(i, 1, $scope.getSmartSearchResult($scope.smartSearch[i]));
        }
        $scope.buildAllSmartSearchComments();
    };

    $scope.setSearchTextCheckboxes = function(search) {
        if (search.search_text != '') {
            search.tags = true;
            search.text = true;
        } else {
            search.tags = false;
            search.text = false;
        }
    };

    $scope.resetAllSingleStudent = function() {
        $scope.studentName = '';
        $scope.oldStudentName = null;
        $scope.gender = 'male';
        $scope.className = '';
        $scope.oldClassName = null;
        $scope.searchComments = '';
        $scope.yourCommentIntroduction = '';
        $scope.yourComment = '';
        $scope.yourCommentConclusion = '';

        if ($scope.toneFilterSetting != 'Any') {

            // put the comments back in
            if ($scope.allComments.length > 0) {
                $scope.comments = $scope.allComments;
            }

        }
        $scope.toneFilterSetting = 'Any';

        $scope.illToastToThat('All fields reset')
    };

    $scope.resetAllMultiStudent = function() {
        $scope.newMultiStudent = '';
        $scope.gender = 'male';
        $scope.className = '';
        $scope.oldClassName = null;
        $scope.yourCommentIntroduction = '';
        $scope.yourComment = '';
        $scope.yourCommentConclusion = '';
    };

    $scope.resetAllSmartSearch = function() {
        $scope.newSmartSearch = {search_text: '', found_comment: '', tone: 'Any', tags: true, text: true};
    };

    $scope.removeAllMultiStudents = function() {
        $scope.multiStudent = [];
        $scope.allMultiStudentComments = '';
    };

    $scope.selectTab = function() {
        if ($scope.comments.length > 0) {
            if ($scope.selectedTab == 0) {
                $location.search('tab', null);
            } else if ($scope.selectedTab == 1) {
                $location.search('tab', 'single-student');
            } else if ($scope.selectedTab == 2) {
                $location.search('tab', 'multi-student');
            } else if ($scope.selectedTab == 3) {
                $location.search('tab', 'smart-search');
            } else if ($scope.selectedTab == 4) {
                $location.search('tab', 'settings');
            } else if ($scope.selectedTab == 5) {
                $location.search('tab', 'donate');
            }
        }
    };

    $scope.setMobileSettings = function() {
        if ($mdMedia('xs')) {
            $scope.commentSizeToGet = 2000;
            $scope.showTooltips = false;
            //$scope.showTags = false;
            //$scope.showHints = true;
            $scope.showEditButtons = false;
        } else if ($mdMedia('sm')) {
            $scope.showTooltips = false;
            //$scope.showHints = true;
            $scope.commentSizeToGet = 6000;
        }
    };

    $scope.setTab = function() {
        var params = $location.search();
        if (params.tab == 'single-student') {
            $scope.selectedTab = 1;
        } else if (params.tab == 'multi-student') {
            $scope.selectedTab = 2;
        } else if (params.tab == 'smart-search') {
            $scope.selectedTab = 3;
        } else if (params.tab == 'settings') {
            $scope.selectedTab = 4;
        } else if (params.tab == 'donate') {
            $scope.selectedTab = 5;
        }
    };

    $scope.setPassword = function() {
        var params = $location.search();
        if (params.hasOwnProperty('password')) {
            $scope.editingPasswordTry = params.password;
        }
    };

    $scope.setPassword();
    $scope.setTab();
    $scope.setMobileSettings();
    $scope.getComments();

});
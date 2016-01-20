var commentApp = angular.module('commentApp', ['angular-clipboard', 'ngMaterial'])
    .config(function($mdThemingProvider) {
        $mdThemingProvider.theme('default')
            .primaryPalette('amber')
            .accentPalette('deep-purple')
            .backgroundPalette('grey').dark();
    });

commentApp.directive('onReadFile', function ($parse) {
    return {
        restrict: 'A',
        scope: false,
        link: function(scope, element, attrs) {
            var fn = $parse(attrs.onReadFile);

            element.on('change', function(onChangeEvent) {
                var reader = new FileReader();

                reader.onload = function(onLoadEvent) {
                    scope.$apply(function() {
                        fn(scope, {$fileContent:onLoadEvent.target.result});
                    });
                };

                reader.readAsText((onChangeEvent.srcElement || onChangeEvent.target).files[0]);
            });
        }
    };
});

commentApp.directive('chooseFileButton', function() {
    return {
        restrict: 'A',
        link: function (scope, elem, attrs) {
            elem.bind('click', function() {
                angular.element(document.querySelector('#' + attrs.chooseFileButton))[0].click();
            });
        }
    };
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
    
    // application state - this is the object that gets saved or loaded
    $scope.state = {
        class_name: '',
        old_class_name: '',
        introduction: '',
        conclusion: '',
        students: [],
        all_student_comments: '',
        global_pattern: [],
        settings: {
            showTooltips: true,
            showHints: false,
            showTone: true,
            showTags: true,
            showEditButtons: true,
            makeSomethingUpSize: 10,
            getSearchResultCount: false,
            avoidHer: true,
            enableNeutralGender: false,
            reduceCommentsSize: 10000,
            showCommonTags: false,
            newStudentFill: 'random',
            useSmartSearch: false
        }
    };

    // single student search and filter
    $scope.searchComments = '';
    $scope.toneFilterSetting = 'Any';
    $scope.toneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative', 'Unrated', 'Flagged'];

    // adding a student
    $scope.gender = 'male';
    $scope.newMultiStudent = '';
    
    // editing a student
    $scope.editingStudent = null;

    // patterns
    $scope.editingPattern = [];
    $scope.newPatternPiece = {search_text: '', found_comment: '', tone: 'Any', tags: false, text: false};
    $scope.limitedToneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative'];

    // pagination
    $scope.commentViewLimit = 20;
    $scope.commentViewBegin = 0;
    $scope.currentCommentsPage = 1;
    $scope.totalCommentPages = null;
    
    // navigation
    $scope.tabIndexes = {
        main_page: 0,
        build: 1,
        search: 2,
        patterns: 3,
        donate: 4
    };
    $scope.selectedTab = $scope.tabIndexes.main_page;


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
                //console.log('returned success');
                //console.log(data.comments.length + ' comments received');

                $scope.comments = data.comments;
                $scope.totalCommentsSize = data.total_size;
                $scope.commonTags = data.common_tags;

                if ($scope.selectedTab == $scope.tabIndexes.settings && $scope.comments.length < $scope.totalCommentsSize) {
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

        if ($scope.editingStudent == null) {
            return;
        }

        //console.log('Adding comment: ' + comment);

        comment = $scope.capitalizeFirstLetter(
            $scope.fixGenderPronouns(
                $scope.replaceClassName(
                    $scope.replaceStudentName(comment, $scope.editingStudent.name, $scope.editingStudent.old_name)
                ), $scope.editingStudent.gender
            )
        );

        if ($scope.editingStudent.comment == '') {
            $scope.editingStudent.comment = comment;
        } else {
            $scope.editingStudent.comment = $scope.editingStudent.comment + ' ' + comment;
        }

        if (showToast) {
            $scope.illToastToThat('Comment added');
        }
    };

    $scope.changeStudentGender = function(student) {
        student.comment = $scope.fixGenderPronouns(student.comment, student.gender);
        $scope.illToastToThat('Gender for ' + student.name + ' changed to ' + student.gender);
    };

    $scope.fixGenderPronouns = function(text, gender) {

        if (gender == undefined) {
            gender = $scope.gender;
            //console.log('using single student gender of ' + $scope.gender);
        }

        var subject;
        var object;
        var possessiveAdjectives;
        var possessivePronouns;
        var reflexivePronouns;
        var girlBoyChild;
        var manLadyAdult;

        //console.log('Changing gender to ' + gender + ' for the text:\n' + text);
        if (gender == 'male') {
            subject = 'he';
            object = 'him';
            possessiveAdjectives = 'his';
            possessivePronouns = 'his';
            reflexivePronouns = 'himself';
            girlBoyChild = 'boy';
            manLadyAdult = 'man';
        } else if (gender == 'female') {
            subject = 'she';
            object = 'her';
            possessiveAdjectives = 'her';
            possessivePronouns = 'hers';
            reflexivePronouns = 'herself ';
            girlBoyChild = 'girl';
            manLadyAdult = 'lady';
        } else {
            subject = 'they';
            object = 'them';
            possessiveAdjectives = 'their';
            possessivePronouns = 'theirs';
            reflexivePronouns = 'themselves';
            girlBoyChild = 'child';
            manLadyAdult = 'adult';
        }

        text = text.replace(/\bboy\b|\bgirl\b|\bchild\b/g,girlBoyChild).replace(/\bBoy\b|\bGirl\b|\bChild\b/g,$scope.capitalizeFirstLetter(girlBoyChild));
        text = text.replace(/\bman\b|\blady\b|\badult\b/g,girlBoyChild).replace(/\bMan\b|\bLady\b|\bAdult\b/g,$scope.capitalizeFirstLetter(manLadyAdult));
        text = text.replace(/\bhe\b|\bshe\b|\bthey\b/g,subject).replace(/\bhis\b|\bhers\b|\btheirs\b/g,possessivePronouns).replace(/\bhim\b|\bher\b|\bthem\b/g,object).replace(/\bhis\b|\bher\b|\btheir\b/g,possessiveAdjectives).replace(/\bhimself\b|\bherself\b|\btheirself\b/g,reflexivePronouns);
        text = text.replace(/\bHe\b|\bShe\b|\bThey\b/g,$scope.capitalizeFirstLetter(subject)).replace(/\bHim\b|\bHer\b|\bThem\b/g,$scope.capitalizeFirstLetter(object)).replace(/\bHis\b|\bHers\b|\bTheirs\b/g,$scope.capitalizeFirstLetter(possessivePronouns)).replace(/\bHis\b|\bHer\b|\bTheir\b/g,$scope.capitalizeFirstLetter(possessiveAdjectives)).replace(/\bHimself\b|\bHerself\b|\bTheirself\b/g,$scope.capitalizeFirstLetter(reflexivePronouns));
        //console.log('Gender Fixed text length: ' + text.length);
        return text;
    };

    $scope.changeClassName = function() {
        //console.log('class name: ' + $scope.state.class_name);
        //console.log('old class name: ' + $scope.state.old_class_name);

        if ($scope.state.class_name == null || $scope.state.class_name == '' || $scope.state.class_name == $scope.state.old_class_name) {
            return;
        }

        $scope.state.introduction = $scope.replaceClassName($scope.state.introduction);
        $scope.state.conclusion = $scope.replaceClassName($scope.state.conclusion);

        if ($scope.state.students.length > 0) {
            for (var i = 0; i < $scope.state.students.length; ++i) {
                $scope.state.students[i].comment = $scope.replaceClassName($scope.state.students[i].comment, true);
            }
            $scope.state.all_student_comments();
        }
        
        $scope.state.old_class_name = $scope.state.class_name;

        $scope.illToastToThat('Class name changed to ' + $scope.state.class_name);
    };

    $scope.replaceStudentName = function(text, studentName, oldStudentName) {
        //console.log('replacing ' + oldStudentName + ' with ' + studentName + ' for the text ' + text);
        if (studentName != null && studentName != '') {
            if (oldStudentName != null && oldStudentName != '' && studentName != oldStudentName) {
                text = text.replace(new RegExp($scope.oldStudentName, 'g'), studentName);
            }
            text = text.replace(/STUDENT_NAME/g, studentName);
            //console.log('Fixed text: ' + text);
            return text;
        }
        return text;
    };

    $scope.changeStudentName = function(student) {
        if (student.name != null && student.name != '' && student.name != student.old_name) {
            if (student.old_name != null && student.old_name != '') {
                student.comment = student.comment.replace(new RegExp(student.old_name, 'g'), student.name);
            }
            student.old_name = student.name;
            student.comment = student.comment.replace(/STUDENT_NAME/g, student.name);
            $scope.illToastToThat('Changed student name to ' + student.name);
        }
    };
    
    $scope.replaceClassName = function(text) {
        //console.log('Changing class name for ' + text);
        var className;
        if ($scope.state.class_name == null || $scope.state.class_name == '') {
            className = 'CLASS_NAME';
        } else {
            className = $scope.state.class_name;
        }

        if ($scope.state.old_class_name != null && $scope.state.old_class_name.length > 0) {
            text = text.replace(new RegExp($scope.state.old_class_name, 'g'), className);
        }
        
        return text.replace(/CLASS_NAME/g, className);
    };

    $scope.capitalizeFirstLetter = function(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    $scope.changeCommentsPerPage = function() {
        //console.log('Changing comment limit to ' + $scope.commentViewLimit);
        $scope.currentCommentsPage = 1;
        $scope.totalCommentPages = Math.ceil($scope.comments.length / $scope.commentViewLimit);
        $scope.commentViewBegin = 0;
    };

    $scope.changeCommentsPage = function(newPage) {
        if ($scope.currentCommentsPage != newPage) {
            //console.log('Changing page to ' + newPage);
            if (newPage >= 1 && newPage <= $scope.totalCommentPages) {
                $scope.currentCommentsPage = newPage;
                $scope.commentViewBegin = ($scope.currentCommentsPage - 1) * $scope.commentViewLimit;
            }
        }
    };

    $scope.showEditCommentDialog = function(comment) {

        $scope.editingComment = angular.copy(comment);

        //console.log('editing comment: ' + $scope.editingComment);
        if (!$scope.editingComment.hasOwnProperty('tags')) {
            $scope.editingComment.tags = [];
        } else {
            //console.log('copying old tags');
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

                    //console.log('in saveDialog');
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

                    //console.log('in saveDialog');
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

        //console.log('editing comment: ' + $scope.editingComment);
        if (!$scope.editingComment.hasOwnProperty('tags')) {
            $scope.editingComment.tags = [];
        } else {
            //console.log('copying old tags');
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

                    //console.log('in saveDialog');
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

    $scope.showFinishedComments = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/finished-comments.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showSettings = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/settings.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showSearchSettings = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/search-settings.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showPatternSettings = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/pattern-settings.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showWalkthrough = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/walkthrough.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showBuildHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/build-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showSearchHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/search-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.showPatternsHelp = function() {
        $mdDialog.show({
            clickOutsideToClose: true,
            scope: $scope,        // use parent scope in template
            preserveScope: true,  // do not forget this if use parent scope
            templateUrl: '/patterns-help.html',
            controller: function DialogController($scope, $mdDialog) {
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                };
            }
        });
    };

    $scope.changeFilter = function() {
        //console.log('changing the filter to ' + $scope.toneFilterSetting);
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
        //console.log('done changing filter');
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
            //console.log('detected male');
        } else if ($scope.newMultiStudent.endsWith(' f') || $scope.newMultiStudent.endsWith(' F')) {
            student.gender = "female";
            student.name = $scope.newMultiStudent.replace(' f', '').replace(' F', '');
        } else if ($scope.state.enableNeutralGender && ($scope.newMultiStudent.endsWith(' n') || $scope.newMultiStudent.endsWith(' N'))) {
            student.gender = "neutral";
            student.name = $scope.newMultiStudent.replace(' n', '').replace(' N', '');
        } else {
            student.name = $scope.newMultiStudent;
            student.gender = $scope.gender;
            //console.log('Setting to default gender of ' + $scope.gender);
        }
        student.old_name = student.name;

        // make an id for this student, based on their name + 8 random characters
        student.student_id = student.name.replace(/\s+/g, '');
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var random = 0; random < 8; ++random) {
            student.student_id += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        if ($scope.state.settings.newStudentFill == 'blank') {

            // start with blank pattern
            student.comment = '';

        } else if ($scope.state.settings.newStudentFill == 'random') {

            // start with totally random comment
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.getRandomComments(), student.name, student.old_name), true), student.gender);

        } else if ($scope.state.settings.newStudentFill == 'default_pattern' && $scope.state.global_pattern.length > 0) {

            // start with global pattern, put global pattern on student
            student.comment = '';
            for (var i = 0; i < $scope.state.global_pattern.length; ++i) {
                student.comment += $scope.capitalizeFirstLetter($scope.getSmartSearchResult($scope.state.global_pattern[i]).found_comment + ' ');
            }
            student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName(student.comment, student.name, student.old_name), true), student.gender);
            student.pattern = angular.copy($scope.state.global_pattern);
            student.pattern_type = 'global';

        }

        $scope.state.students.push(student);
        $scope.newMultiStudent = '';

        $scope.illToastToThat('Added student: ' + student.name + ' (' + student.gender + ')');

        $scope.buildAllStudentComments();
    };

    $scope.regenerateMultiStudentComment = function(student, forceRandom) {
        if (forceRandom || !student.pattern) {
            //console.log('regenerating random');
            student.comment = $scope.getRandomComments();
        } else {
            //console.log('regenerating based on pattern');
            student.comment = '';
            for (var i = 0; i < student.pattern.length; ++i) {
                var matchFound = $scope.getSmartSearchResult(student.pattern[i]).found_comment + ' ';
                //console.log('adding ' + matchFound + ' to ' + student.name);
                student.comment += matchFound;
                //student.comment += $scope.getSmartSearchResult(student.pattern[i]).found_comment + ' ';
            }
        }

        student.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName(student.comment, student.name, student.old_name)), student.gender);
        //console.log('regenerated student comment length: ' + student.comment.length);
    };


    $scope.regenerateAllStudentComments = function(random) {
        for (var i = 0; i < $scope.state.students.length; ++i) {
            $scope.regenerateMultiStudentComment($scope.state.students[i], random);
        }
    };

    $scope.applyGlobalToAll = function() {
        for (var i = 0; i < $scope.state.students.length; ++i) {
            $scope.state.students[i].pattern = angular.copy($scope.editingPattern);
            $scope.state.students[i].pattern_type = 'global';
            $scope.regenerateMultiStudentComment($scope.state.students[i]);
        }
        $scope.illToastToThat('Default pattern applied to all students');
    };

    $scope.makeSomethingUp = function() {
        $scope.yourComment = '';
        $scope.addComment($scope.getRandomComments(), false);
        $scope.illToastToThat('Random comment generated');
    };

    $scope.getRandomComments = function(size) {
        var fullRandomComment = '';

        if (size == null) {
            size = $scope.state.settings.makeSomethingUpSize;
        }

        for (var i = 0; i < size; ++i) {
            var randomComment = $scope.comments[Math.floor(Math.random() * $scope.comments.length)];

            if ($scope.state.settings.avoidHer && $scope.gender != 'female' && (randomComment.comment_text.indexOf(' her ') > 0 || randomComment.comment_text.startsWith('Her') || randomComment.comment_text.endsWith(' her.'))) {
                --i;
                continue;
            }

            //console.log('Found random comment ' + randomComment.comment_id);

            if (fullRandomComment == '') {
                fullRandomComment = $scope.capitalizeFirstLetter(randomComment.comment_text);
            } else {
                fullRandomComment = fullRandomComment + ' ' + $scope.capitalizeFirstLetter(randomComment.comment_text)
            }

        }

        return fullRandomComment;
    };

    $scope.removeMultiStudent = function(student) {
        var index = $scope.state.students.indexOf(student);
        if (index > -1) {
            $scope.state.students.splice(index, 1);
        }

        $scope.state.all_student_comments();
    };

    $scope.shuffleAllStudentComments = function() {
        for (var i = 0; i < $scope.state.students.length; ++i) {
            $scope.shuffleMultiStudentComment($scope.state.students[i]);
        }
    };

    $scope.shuffleMultiStudentComment = function(student) {
        student.comment = $scope.shuffleText(student.comment);
    };

    $scope.shuffleText = function(text) {
        var sentences = text.match( /[^\.!\?]+[\.!\?]+/g );
        //console.log('Found ' + sentences.length + ' sentences');

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

    $scope.buildWholeStudentComment = function(student) {
        //console.log('building whole comment');
        student.whole_comment = '';
        if ($scope.state.introduction.length > 0) {
            student.whole_comment += $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.state.introduction, student.name, student.old_name), true), student.gender).trim() + ' ';
        }
        if (student.comment.length > 0) {
            student.whole_comment += student.comment.trim() + ' ';
        }
        if ($scope.state.conclusion.length > 0) {
            student.whole_comment += $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.state.conclusion, student.name, student.old_name), true), student.gender).trim();
        }

        //console.log('whole comment: ' + student.whole_comment);
    };

    $scope.buildAllStudentComments = function() {
        $scope.state.all_student_comments = '';
        for (var i = 0; i < $scope.state.students.length; ++i) {
            $scope.state.all_student_comments += $scope.state.students[i].name + ':\n\n';

            $scope.state.all_student_comments += '\t';
            if ($scope.state.introduction.length > 0) {
                $scope.state.all_student_comments += $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.state.introduction, $scope.state.students[i].name, $scope.state.students[i].old_name), true), $scope.state.students[i].gender).trim() + ' ';
            }
            if ($scope.state.students[i].comment.length > 0) {
                $scope.state.all_student_comments += $scope.state.students[i].comment.trim() + ' ';
            }
            if ($scope.state.conclusion.length > 0) {
                $scope.state.all_student_comments += $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.state.conclusion, $scope.state.students[i].name, $scope.state.students[i].old_name), true), $scope.state.students[i].gender).trim();
            }

            if (i < $scope.state.students.length - 1) {
                $scope.state.all_student_comments += '\n\n\n';
            } else {
                $scope.state.all_student_comments += '\n';
            }

            $scope.state.all_student_comments = $scope.state.all_student_comments.replace(/  +/g, ' ');
        }
    };

    $scope.editStudentWithSearch = function(student) {
        $scope.editingStudent = angular.copy(student);
        $scope.selectedTab = $scope.tabIndexes.search;
    };

    $scope.doneEditingStudentPattern = function() {
        for (var i = 0; i < $scope.state.students.length; ++i) {
            if ($scope.state.students[i].student_id == $scope.editingStudent.student_id) {
                $scope.state.students[i] = $scope.editingStudent;
                $scope.editingStudent = null;

                if ($scope.editingPattern.length > 0) {
                    $scope.state.students[i].pattern = angular.copy($scope.editingPattern);
                    $scope.editingPattern = [];
                    $scope.state.students[i].pattern_type = 'individual';
                }

                $scope.selectedTab = $scope.tabIndexes.build;
                $scope.illToastToThat('Saved pattern changes for ' + $scope.state.students[i].name);
                $scope.buildWholeStudentComment($scope.state.students[i]);
                return;
            }
        }
        $scope.illToastToThat('Error saving student changes!');
    };

    $scope.doneEditingStudentSearch = function() {
        for (var i = 0; i < $scope.state.students.length; ++i) {
            if ($scope.state.students[i].student_id == $scope.editingStudent.student_id) {
                $scope.state.students[i] = $scope.editingStudent;
                $scope.editingStudent = null;
                $scope.selectedTab = $scope.tabIndexes.build;
                $scope.illToastToThat('Saved comment changes for ' + $scope.state.students[i].name);
                $scope.buildWholeStudentComment($scope.state.students[i]);
                return;
            }
        }
        $scope.illToastToThat('Error saving student changes!');
    };

    $scope.applyGlobalPatternToStudent = function(student) {
        student.pattern = angular.copy($scope.state.global_pattern);
        $scope.regenerateMultiStudentComment(student, false);
        student.pattern_type = 'global';
    };

    $scope.editMultiStudentAsSmartSearch = function(student) {

        $scope.editingStudent = angular.copy(student);

        if ($scope.editingStudent.pattern) {
            $scope.editingPattern = angular.copy($scope.editingStudent.pattern);
        } else if ($scope.editingStudent.comment.length > 0) {

            //console.log('Creating Multi Student Smart Search profile');
            // import the existing multi student sentence into smart search

            var sentences = $scope.editingStudent.comment.match( /[^\.!\?]+[\.!\?]+/g );

            $scope.editingPattern = [];
            for (var i = 0; i < sentences.length; ++i) {
                //console.log(sentences[i]);
                $scope.editingPattern.push({search_text: '', found_comment: sentences[i].trim(), tone: 'Any'});
            }

        } else if ($scope.editingStudent.comment.length == 0) {
            $scope.editingPattern = [];
        }

        $scope.editingStudent.pattern_type = 'individual';

        $scope.selectedTab = $scope.tabIndexes.patterns;
        $scope.illToastToThat('Editing '+ $scope.editingStudent.name + ' pattern.')
    };

    $scope.removeAllSmartSearch = function() {
        $scope.editingPattern = [];
    };

    $scope.loadSampleSmartSearch = function() {
        $scope.editingPattern = [];
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: '', found_comment: '', tone: 'Positive'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'reading', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'behavior', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'speaking', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'comprehension', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'phonics', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: 'writing', found_comment: '', tone: 'Any'}));
        $scope.editingPattern.push($scope.getSmartSearchResult({search_text: '', found_comment: '', tone: 'Positive'}));
        $scope.buildAllSmartSearchComments();
    };

    $scope.reloadWithLimit = function(limit) {
        if (limit != null) {
            $location.search('limit', limit);
        } else {
            $location.search('limit', $scope.state.settings.reduceCommentsSize);
        }
        location.reload();
    };

    $scope.formatNumber = function(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    $scope.getSmartSearchResult = function(search, getResultCount) {

        // if there are no working search parameters passed then do not actually count the results, it's pointless!
        if (getResultCount && search.tone == 'Any' && (search.search_text == '' || (!search.tags && !search.text))) {
            getResultCount = false;
        }

        //if (getResultCount) {
        //    console.log('getting count');
        //} else {
        //    console.log('not getting count');
        //}

        search.found_comment = '';

        //console.log('search text: ' + search.search_text);

        // we start looking at a random starting point so that we don't end up getting the same comments for every search
        var randomStartingPoint = Math.floor((Math.random() * $scope.comments.length));
        //console.log('Starting at random index ' + randomStartingPoint);

        var searchResults = 0;
        for (var i = randomStartingPoint; i < $scope.comments.length + randomStartingPoint; ++i) {

            var index = i;
            if (index >= $scope.comments.length) {
                index -= $scope.comments.length;
            }

            if ($scope.state.settings.avoidHer && $scope.gender != 'female' && ($scope.comments[index].comment_text.indexOf(' her ') > 0 || $scope.comments[index].comment_text.startsWith('Her') || $scope.comments[index].comment_text.endsWith(' her.'))) {
                continue;
            }

            if ((search.tone == 'Positive' && $scope.comments[index].pos_neg != 1) || (search.tone == 'Neutral' && $scope.comments[index].pos_neg != 0) || (search.tone == 'Negative' && $scope.comments[index].pos_neg != -1)) {
                continue;
            }

            if ($scope.comments[index].comment_text.toLowerCase().indexOf(search.search_text) < 0 && (!$scope.comments[index].hasOwnProperty('tags') || $scope.comments[index].tags.indexOf(search.search_text) < 0)) {
                continue;
            }

            //console.log('Searched ' + i + ' comments');
            //console.log('Found comment matching search: ' + $scope.comments[index].comment_text);

            ++searchResults;
            if (!getResultCount) {
                search.found_comment = $scope.capitalizeFirstLetter($scope.comments[index].comment_text).trim();
                break;
            } else if (search.found_comment == '') {
                search.found_comment = $scope.capitalizeFirstLetter($scope.comments[index].comment_text).trim();
            }
        }

        if (getResultCount) {
            search.result_count = searchResults;
        }

        return angular.copy(search);
    };

    $scope.resubmitSearch = function(search, getResultCount) {
        //console.log('resubmitting search for ' + search.search_text);
        //console.log('getResultCount ? ' + getResultCount);
        var newSearch = $scope.getSmartSearchResult(search, getResultCount);
        search.found_comment = newSearch.found_comment;
        if (getResultCount) {
            //console.log('result count for new search parameters: ' + newSearch.result_count);
            search.result_count = newSearch.result_count;
        }
    };

    $scope.shuffleSmartSearch = function() {
        for(var j, x, i = $scope.editingPattern.length; i; j = Math.floor(Math.random() * i), x = $scope.editingPattern[--i], $scope.editingPattern[i] = $scope.editingPattern[j], $scope.editingPattern[j] = x) {}
        $scope.buildAllSmartSearchComments();
    };

    $scope.buildAllSmartSearchComments = function() {
        if ($scope.editingStudent != null) {
            $scope.editingStudent.comment = '';
            for (var i = 0; i < $scope.editingPattern.length; ++i) {
                $scope.editingStudent.comment += $scope.capitalizeFirstLetter($scope.editingPattern[i].found_comment).trim() + ' ';
            }
            $scope.editingStudent.comment = $scope.fixGenderPronouns($scope.replaceClassName($scope.replaceStudentName($scope.state.conclusion, $scope.editingStudent.name, $scope.editingStudent.old_name)), $scope.editingStudent.gender).trim();
        }
    };

    $scope.justMakeSomethingUpSmartSearch = function() {
        $scope.state.global_pattern = [];
        for (var i = 0; i < $scope.state.settings.makeSomethingUpSize; ++i) {
            $scope.state.global_pattern.push($scope.getSmartSearchResult($scope.newPatternPiece));
        }
        $scope.buildAllSmartSearchComments();
    };

    $scope.regenerateAllSmartSearch = function() {
        //console.log('Regenerating ' + $scope.state.global_pattern.length + ' searches');
        for (var i = 0; i < $scope.state.global_pattern.length; ++i) {
            $scope.state.global_pattern[i].found_comment = $scope.getSmartSearchResult($scope.state.global_pattern[i]).found_comment;
        }
        $scope.buildAllSmartSearchComments();
    };

    $scope.removeAllPatternPieces = function() {
        $scope.editingPattern = [];
    };

    $scope.resetAllSmartSearch = function() {
        $scope.newPatternPiece = {search_text: '', found_comment: '', tone: 'Any', tags: true, text: true};
    };

    $scope.removeAllMultiStudents = function() {
        $scope.state.students = [];
        $scope.state.all_student_comments = '';
    };

    $scope.setMobileSettings = function() {
        if ($mdMedia('xs')) {
            $scope.commentSizeToGet = 2000;
            $scope.state.settings.showTooltips = false;
            //$scope.showTags = false;\
            //$scope.showHints = true;
            $scope.state.settings.showEditButtons = false;
        } else if ($mdMedia('sm')) {
            $scope.state.settings.showTooltips = false;
            //$scope.showHints = true;
            $scope.commentSizeToGet = 6000;
        }
    };

    $scope.selectTab = function() {

        // set the search locations
        if ($scope.selectedTab == $scope.tabIndexes.main_page) {
            //console.log('tab selected : main_page');
            $location.search('tab', null);
        } else if ($scope.selectedTab == $scope.tabIndexes.search) {
            //console.log('tab selected : single_student');
            $location.search('tab', 'search');
        } else if ($scope.selectedTab == $scope.tabIndexes.build) {
            //console.log('tab selected : multi_student');
            $location.search('tab', 'build');
        } else if ($scope.selectedTab == $scope.tabIndexes.patterns) {
            //console.log('tab selected : smart_search');
            $location.search('tab', 'patterns');

            if ($scope.editingStudent == null) {
                $scope.editingPattern = $scope.state.global_pattern;
            }

        } else if ($scope.selectedTab == $scope.tabIndexes.settings) {
            //console.log('tab selected : settings');
            $location.search('tab', 'settings');
        } else if ($scope.selectedTab == $scope.tabIndexes.donate) {
            //console.log('tab selected : donate');
            $location.search('tab', 'donate');
        }

        // maybe save the global pattern when we switch off this tab
        if ($scope.selectedTab != $scope.tabIndexes.patterns && $scope.editingPattern.length > 0 && !$scope.editingStudent) {
            $scope.state.settings.newStudentFill = 'default_pattern';
            $scope.state.global_pattern = angular.copy($scope.editingPattern);
            //console.log('saving editing pattern to global');
        }

    };

    $scope.setTab = function() {
        var params = $location.search();
        if (params.tab == 'search') {
            $scope.selectedTab = $scope.tabIndexes.search;
        } else if (params.tab == 'build') {
            $scope.selectedTab = $scope.tabIndexes.build;
        } else if (params.tab == 'patterns') {
            $scope.selectedTab = $scope.tabIndexes.patterns;
        } else if (params.tab == 'settings') {
            $scope.selectedTab = $scope.tabIndexes.settings;
        } else if (params.tab == 'donate') {
            $scope.selectedTab = $scope.tabIndexes.donate;
        }
    };

    $scope.showConfirm = function(ev) {
        // Appending dialog to document.body to cover sidenav in docs app
        var confirm = $mdDialog.confirm()
            .title('Reset Comment Breeze')
            .textContent('Resetting the application will erase all work, but will not use data.')
            .ariaLabel('Reset Comment Breeze')
            .targetEvent(ev)
            .ok('Reset')
            .cancel('Cancel');
        $mdDialog.show(confirm).then(function() {
            $scope.state = {
                class_name: '',
                old_class_name: '',
                introduction: '',
                conclusion: '',
                students: [],
                all_student_comments: '',
                global_pattern: [],
                settings: {
                    showTooltips: true,
                    showHints: false,
                    showTone: true,
                    showTags: true,
                    showEditButtons: true,
                    makeSomethingUpSize: 10,
                    getSearchResultCount: false,
                    avoidHer: true,
                    enableNeutralGender: false,
                    reduceCommentsSize: 10000,
                    showCommonTags: false,
                    newStudentFill: 'random',
                    useSmartSearch: false
                }
            };

            // single student search and filter
            $scope.searchComments = '';
            $scope.toneFilterSetting = 'Any';
            $scope.toneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative', 'Unrated', 'Flagged'];

            // adding a student
            $scope.gender = 'male';
            $scope.newMultiStudent = '';

            // editing a student
            $scope.editingStudent = null;

            // patterns
            $scope.editingPattern = [];
            $scope.newPatternPiece = {search_text: '', found_comment: '', tone: 'Any', tags: false, text: false};
            $scope.limitedToneFilterOptions = ['Any', 'Positive', 'Neutral', 'Negative'];

            // pagination
            $scope.commentViewLimit = 20;
            $scope.commentViewBegin = 0;
            $scope.currentCommentsPage = 1;
            $scope.totalCommentPages = null;

            $scope.illToastToThat('Application reset')
        }, function() {

        });
    };

    $scope.setPassword = function() {
        var params = $location.search();
        if (params.hasOwnProperty('password')) {
            $scope.editingPasswordTry = params.password;
        }
    };

    $scope.saveState = function () {
        $scope.toJSON = '';
        $scope.toJSON = angular.toJson($scope.state, true);
        var blob = new Blob([$scope.toJSON], { type:"application/json;charset=utf-8;" });
        var downloadLink = angular.element('<a></a>');
        downloadLink.attr('href', window.URL.createObjectURL(blob));

        // all this just to get the date
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth()+1; //January is 0!
        var yyyy = today.getFullYear();
        if(dd<10) {
            dd='0'+dd
        }
        if(mm<10) {
            mm='0'+mm
        }
        today = yyyy+'-'+mm+'-'+dd;

        var fileName;
        if ($scope.state.class_name != '') {
            fileName = 'Comment Breeze ' + $scope.state.class_name + ' ' + today + '.txt';
        } else {
            fileName = 'Comment Breeze ' + today + '.txt';
        }

        downloadLink.attr('download', fileName);
        downloadLink[0].click();
    };

    $scope.loadState = function (state) {
        //console.log('loading state: ' + state);
        $scope.state = JSON.parse(state);
    };

    $scope.setPassword();
    $scope.setTab();
    $scope.setMobileSettings();
    $scope.getComments();

});